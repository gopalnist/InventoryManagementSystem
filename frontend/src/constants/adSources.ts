/**
 * Ad source / channel values for ads reports (aligned with report-service upload API).
 * Use for Ads Reports filter dropdown and ads upload "Ad Source" selector.
 */
export const AD_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'zepto', label: 'Zepto' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'bigbasket', label: 'BigBasket' },
  { value: 'swiggy', label: 'Swiggy' },
  { value: 'amazon_ads', label: 'Amazon Advertising' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'google_pla', label: 'Google PLA' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'weekly_report', label: 'Weekly report (Amazon ads)' },
];
