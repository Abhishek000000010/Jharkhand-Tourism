/**
 * Loads the Razorpay Checkout script on demand.
 *
 * Injected lazily rather than in index.html so that a deployment running on the mock
 * gateway never reaches out to Razorpay at all, and the script is fetched at most once
 * per page load no matter how many times a user opens the payment sheet.
 */
const SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loader = null;

export const loadRazorpayCheckout = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (loader) return loader;

  loader = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SRC;
    script.onload = () => resolve(true);
    script.onerror = () => { loader = null; resolve(false); };
    document.body.appendChild(script);
  });

  return loader;
};
