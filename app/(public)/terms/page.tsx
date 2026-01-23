import { Card, CardContent } from "@/components/ui/card";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Solara Insights",
  description: "Terms of Service for Solara Insights - the rules and guidelines for using our platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Solara Logo - subtle */}
      <div className="flex justify-center items-center pt-2 pb-4">
        <SolaraLogo />
      </div>

      <h1 className="text-4xl font-bold text-center mb-4">Terms of Service</h1>
      <p className="text-center text-accent-ink/60 mb-12">
        Effective Date: December 29, 2025
      </p>

      <Card className="p-8 md:p-12">
        <CardContent className="space-y-10 p-0">
          {/* Introduction */}
          <section>
            <p className="text-lg text-accent-ink/80 leading-relaxed">
              Welcome to Solara Insights. These Terms of Service (&quot;Terms&quot;) govern
              your access to and use of our website, applications, and services (collectively,
              the &quot;Service&quot;). By using the Service, you agree to be bound by these
              Terms.
            </p>
            <p className="text-lg text-accent-ink/80 leading-relaxed mt-4">
              <strong>Contact:</strong> solara@solarainsights.com
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Service Description
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                Solara Insights is a personalized astrology and self-discovery platform. We
                provide horoscopes, birth chart interpretations, relationship insights, and
                other astrological content generated using proprietary methods and trusted
                third-party services.
              </p>
            </div>
          </section>

          {/* Important Disclaimers */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Important Disclaimers
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p className="font-semibold text-accent-ink">
                THE SERVICE IS PROVIDED FOR ENTERTAINMENT AND SELF-REFLECTION PURPOSES ONLY.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Not Medical Advice:</strong> Our content is not a substitute for
                  professional medical, mental health, or healthcare advice, diagnosis, or
                  treatment. Always seek the advice of qualified health providers with any
                  questions you may have.
                </li>
                <li>
                  <strong>Not Legal Advice:</strong> Nothing in our Service constitutes legal
                  advice. Consult a qualified attorney for legal matters.
                </li>
                <li>
                  <strong>Not Financial Advice:</strong> Our content should not be relied upon
                  for financial, investment, or business decisions. Consult a qualified
                  financial advisor.
                </li>
                <li>
                  <strong>No Guarantees:</strong> Astrological insights are interpretive and
                  subjective. We make no guarantees about the accuracy or applicability of any
                  content to your specific situation.
                </li>
              </ul>
              <p>
                You acknowledge that you use the Service at your own discretion and that any
                decisions you make based on our content are your sole responsibility.
              </p>
            </div>
          </section>

          {/* Account Responsibility */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Account Responsibility
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                To access certain features, you must create an account. You are responsible
                for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Providing accurate and complete information</li>
                <li>Maintaining the security of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
              </ul>
              <p>
                You must be at least 13 years old to create an account and use the Service.
              </p>
            </div>
          </section>

          {/* Social Account Connections */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Social Account Connections
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                You may optionally connect social media accounts (such as Facebook, Instagram,
                TikTok, X, or Reddit) to enhance your personalized experience. By connecting a
                social account, you:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Authorize us to access limited, permitted data from your social account as
                  described in our Privacy Policy
                </li>
                <li>Confirm you have the right to grant us this access</li>
                <li>
                  Understand you can disconnect your social account at any time through
                  Settings, which will stop further data collection
                </li>
              </ul>
              <p>
                We use social data solely to generate personalized insights about your
                communication style. We do not post to your social accounts or access private
                messages.
              </p>
            </div>
          </section>

          {/* Payments */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Payments and Subscriptions
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                Some features of the Service require a paid subscription. Payments are
                processed securely through Stripe.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Subscription fees are billed in advance on a recurring basis (monthly or
                  annually)
                </li>
                <li>
                  You authorize us to charge your payment method for the applicable fees
                </li>
                <li>
                  You may cancel your subscription at any time; access continues until the end
                  of the current billing period
                </li>
                <li>We reserve the right to change pricing with reasonable notice</li>
              </ul>
              <p>
                Refunds are handled on a case-by-case basis. Contact solara@solarainsights.com
                for refund requests.
              </p>
            </div>
          </section>

          {/* Free Trial */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Free Trial
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                We may offer free trial periods for new subscribers. If you do not cancel
                before the trial ends, you will be automatically charged the applicable
                subscription fee. Trial availability and duration are at our discretion.
              </p>
            </div>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Acceptable Use
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Service for any unlawful purpose</li>
                <li>Harass, abuse, or harm others through the Service</li>
                <li>
                  Attempt to gain unauthorized access to our systems or other users&apos;
                  accounts
                </li>
                <li>
                  Use automated systems (bots, scrapers) to access the Service without
                  permission
                </li>
                <li>Interfere with or disrupt the Service or its infrastructure</li>
                <li>
                  Resell, redistribute, or commercially exploit our content without
                  authorization
                </li>
                <li>Impersonate any person or entity</li>
                <li>Upload or transmit viruses, malware, or other harmful code</li>
              </ul>
              <p>
                We reserve the right to suspend or terminate accounts that violate these
                rules.
              </p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Intellectual Property
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                The Service and its original content (excluding user-provided content) are
                owned by Solara Insights and are protected by copyright, trademark, and other
                intellectual property laws.
              </p>
              <p>
                You retain ownership of any content you provide. By providing content, you grant
                us a limited license to use it for operating and improving the Service.
              </p>
              <p>
                Generated content provided to you through the Service is licensed to you for
                personal, non-commercial use. You may not resell or redistribute generated
                content for commercial purposes without our written permission.
              </p>
            </div>
          </section>

          {/* User Content */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              User Content
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                You are solely responsible for any content you submit to the Service. By
                submitting content, you represent that you have the right to do so and that
                your content does not violate any third-party rights or applicable laws.
              </p>
              <p>
                We reserve the right to remove any user content that violates these Terms or
                that we deem inappropriate, without notice.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Limitation of Liability
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p className="font-medium">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND,
                  EXPRESS OR IMPLIED
                </li>
                <li>
                  WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
                  SECURE
                </li>
                <li>
                  WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                  PUNITIVE DAMAGES
                </li>
                <li>
                  OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12
                  MONTHS, OR $100, WHICHEVER IS GREATER
                </li>
              </ul>
              <p>
                Some jurisdictions do not allow certain limitations of liability, so some of
                these limitations may not apply to you.
              </p>
            </div>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Indemnification
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                You agree to indemnify and hold harmless Solara Insights and its officers,
                directors, employees, and agents from any claims, damages, losses, or expenses
                (including reasonable attorneys&apos; fees) arising from your use of the
                Service, your violation of these Terms, or your violation of any third-party
                rights.
              </p>
            </div>
          </section>

          {/* Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Dispute Resolution
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                Any dispute arising from these Terms or your use of the Service shall first be
                attempted to be resolved through good-faith negotiation. If negotiation fails,
                disputes shall be resolved through binding arbitration administered by a
                mutually agreed-upon arbitration provider, rather than in court.
              </p>
              <p>
                <strong>Class Action Waiver:</strong> You agree that any dispute resolution
                proceedings will be conducted only on an individual basis and not in a class,
                consolidated, or representative action.
              </p>
              <p>
                <strong>Small Claims Exception:</strong> Either party may bring qualifying
                claims in small claims court.
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Governing Law
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                These Terms are governed by the laws of the Commonwealth of Virginia, United
                States, without regard to conflict of law principles. For any disputes not
                subject to arbitration, you consent to the exclusive jurisdiction of the state
                and federal courts located in Virginia.
              </p>
            </div>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Changes to These Terms
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                We may modify these Terms at any time. We will notify you of material changes
                by posting the updated Terms on this page and updating the &quot;Effective
                Date.&quot; Your continued use of the Service after changes become effective
                constitutes acceptance of the new Terms.
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Termination
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                You may stop using the Service at any time. We may suspend or terminate your
                access if you violate these Terms or for any other reason with reasonable
                notice. Upon termination, your right to use the Service ceases immediately,
                but provisions that by their nature should survive (such as Limitation of
                Liability, Indemnification, and Dispute Resolution) will remain in effect.
              </p>
            </div>
          </section>

          {/* Entire Agreement */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Entire Agreement
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                These Terms, together with our Privacy Policy, constitute the entire agreement
                between you and Solara Insights regarding your use of the Service and
                supersede any prior agreements.
              </p>
            </div>
          </section>

          {/* Severability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Severability
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                If any provision of these Terms is found to be unenforceable, the remaining
                provisions will continue in full force and effect.
              </p>
            </div>
          </section>

          {/* Waiver */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Waiver
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                Our failure to enforce any right or provision of these Terms shall not be
                deemed a waiver of such right or provision.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Contact Us
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="font-medium">
                Solara Insights<br />
                Email: solara@solarainsights.com
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
