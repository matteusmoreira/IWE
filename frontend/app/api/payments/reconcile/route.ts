import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessTokenForTenant, getGlobalAccessToken } from '@/lib/mercadopago'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const reconcileToken = process.env.PAYMENTS_RECONCILE_TOKEN || ''
    if (reconcileToken) {
      const expected = `Bearer ${reconcileToken}`
      if (authHeader !== expected) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
    }

    const url = new URL(req.url)
    const max = Math.max(1, Math.min(50, Number(url.searchParams.get('max')) || 25))
    const ageMinutes = Math.max(1, Number(url.searchParams.get('age_minutes')) || 10)
    const cutoffIso = new Date(Date.now() - ageMinutes * 60 * 1000).toISOString()

    const supabase = createAdminClient()

    const { data: pendentes, error: listError } = await supabase
      .from('submissions')
      .select('id, tenant_id, metadata')
      .eq('payment_status', 'PENDENTE')
      .lt('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(max)

    if (listError) {
      return NextResponse.json({ error: 'list_error', detail: listError.message }, { status: 500 })
    }

    let globalToken = await getGlobalAccessToken()
    if (!globalToken) globalToken = process.env.MP_ACCESS_TOKEN || ''

    let updated = 0
    let unchanged = 0
    let failed = 0
    const results: Array<Record<string, unknown>> = []

    for (const s of pendentes || []) {
      let tokenToUse = globalToken
      if (!tokenToUse && s.tenant_id) {
        tokenToUse = (await getAccessTokenForTenant(s.tenant_id)) || ''
      }
      if (!tokenToUse) {
        failed++
        results.push({ submission_id: s.id, error: 'mp_credentials_missing' })
        continue
      }

      const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(String(s.id))}&sort=id&criteria=desc`
      try {
        const mpRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${tokenToUse}` } })
        const mpData = await mpRes.json()
        const resultsArr = Array.isArray(mpData?.results) ? mpData.results : []
        const last = resultsArr[0] || null
        let status = 'PENDENTE'
        if (last?.status === 'approved') status = 'PAGO'
        else if (last?.status === 'rejected' || last?.status === 'cancelled') status = 'CANCELADO'

        if (last) {
          const { error: updError } = await supabase
            .from('submissions')
            .update({
              payment_status: status,
              payment_date: last.status === 'approved' ? new Date().toISOString() : null,
              payment_amount: last.transaction_amount,
              metadata: {
                ...(s.metadata || {}),
                mp_payment_id: last.id,
                mp_status: last.status,
                mp_status_detail: last.status_detail,
                mp_payment_method: last.payment_method_id,
                mp_payment_type: last.payment_type_id,
              },
            })
            .eq('id', s.id)
          if (updError) {
            failed++
            results.push({ submission_id: s.id, error: updError.message })
          } else {
            updated++
            results.push({ submission_id: s.id, status })
          }
        } else {
          unchanged++
          results.push({ submission_id: s.id, status })
        }
      } catch (e: any) {
        failed++
        results.push({ submission_id: s.id, error: e?.message || 'unexpected_error' })
      }
    }

    return NextResponse.json({
      processed: (pendentes || []).length,
      updated,
      unchanged,
      failed,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 })
  }
}