import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessTokenForTenant, getGlobalAccessToken } from '@/lib/mercadopago'

export async function GET(_req: Request, context: any) {
  try {
    const supabase = createAdminClient()
    const submissionId = context?.params?.submission_id as string
    if (!submissionId) {
      return NextResponse.json({ error: 'missing_submission_id' }, { status: 400 })
    }

    const { data: submission } = await supabase
      .from('submissions')
      .select('id, tenant_id, metadata')
      .eq('id', submissionId)
      .maybeSingle()

    if (!submission) {
      return NextResponse.json({ error: 'submission_not_found' }, { status: 404 })
    }

    let accessToken = await getGlobalAccessToken()
    if (!accessToken && submission.tenant_id) {
      accessToken = await getAccessTokenForTenant(submission.tenant_id)
    }
    if (!accessToken) {
      accessToken = process.env.MP_ACCESS_TOKEN || ''
    }
    if (!accessToken) {
      return NextResponse.json({ error: 'mp_credentials_missing' }, { status: 500 })
    }

    const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(String(submissionId))}&sort=id&criteria=desc`
    const mpRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const mpData = await mpRes.json()
    const results = Array.isArray(mpData?.results) ? mpData.results : []
    const last = results[0] || null

    let status = 'PENDENTE'
    if (last?.status === 'approved') status = 'PAGO'
    else if (last?.status === 'rejected' || last?.status === 'cancelled') status = 'CANCELADO'

    if (last) {
      await supabase
        .from('submissions')
        .update({
          payment_status: status,
          payment_date: last.status === 'approved' ? new Date().toISOString() : null,
          payment_amount: last.transaction_amount,
          metadata: {
            ...(submission.metadata || {}),
            mp_payment_id: last.id,
            mp_status: last.status,
            mp_status_detail: last.status_detail,
            mp_payment_method: last.payment_method_id,
            mp_payment_type: last.payment_type_id,
          },
        })
        .eq('id', submission.id)
    }

    return NextResponse.json({
      submission_id: submissionId,
      status,
      mp: last ? {
        id: last.id,
        status: last.status,
        status_detail: last.status_detail,
        payment_method_id: last.payment_method_id,
        payment_type_id: last.payment_type_id,
      } : null,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 })
  }
}
