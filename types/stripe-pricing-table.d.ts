/**
 * TypeScript declaration for Stripe Pricing Table web component
 *
 * This allows us to use <stripe-pricing-table> in TSX without type errors.
 * The component is loaded via Stripe's external script.
 */

declare namespace JSX {
  interface IntrinsicElements {
    "stripe-pricing-table": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        "pricing-table-id": string;
        "publishable-key": string;
        "client-reference-id"?: string;
        "customer-email"?: string;
        "customer-session-client-secret"?: string;
      },
      HTMLElement
    >;
  }
}
