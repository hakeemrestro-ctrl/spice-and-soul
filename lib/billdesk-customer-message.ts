export function billdeskCustomerMessage(status: unknown): string | null {
  if (status === 'pending') return 'Payment confirmation is pending. If your account was debited, please check back after 60 minutes. Do not make another payment while the status is unresolved.';
  if (status === 'failed') return 'Payment was not completed. Check your payment status before trying again. If money was debited, contact support.';
  return null;
}

/** Only call after authenticated callback and stored order binding succeed. */
export function billdeskFailureHtml(description: unknown, origin: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const reason = typeof description === 'string' && description.length <= 500 && !/[\x00-\x1f\x7f]/.test(description)
    ? description : 'The payment could not be completed.';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Payment not completed</title><main><h1>Payment not completed</h1><p>${escape(reason)}</p><p>If money was debited, contact support before trying again.</p><a href="${escape(origin)}/courses">Return to courses</a></main></html>`;
}
