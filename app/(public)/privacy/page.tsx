import { Card, CardContent } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Solara Insights",
  description: "Privacy Policy for Solara Insights - how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold text-center mb-4">Privacy Policy</h1>
      <p className="text-center text-accent-ink/60 mb-12">
        Effective Date: December 16, 2025
      </p>

      <Card className="p-8 md:p-12">
        <CardContent className="space-y-10 p-0">
          {/* Introduction */}
          <section>
            <p className="text-lg text-accent-ink/80 leading-relaxed">
              Welcome to Solara Insights. We respect your privacy and are committed to protecting your personal data.
              This Privacy Policy explains how we collect, use, share, and safeguard your information when you use our
              services.
            </p>
            <p className="text-lg text-accent-ink/80 leading-relaxed mt-4">
              <strong>Contact:</strong> solara@solarainsights.com
            </p>
          </section>

          {/* What Data We Collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              What Data We Collect
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p><strong>Account Information:</strong> When you create an account, we collect your email address, name, preferred name, and language preference.</p>

              <p><strong>Birth Information:</strong> If you choose to provide it, we collect your birth date, birth time, and birth location to generate personalized astrological insights. This information is entirely optional.</p>

              <p><strong>Social Account Connections:</strong> When you connect a social media account (Facebook, Instagram, TikTok, X, or Reddit), we collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your social media handle/username</li>
                <li>OAuth tokens (stored securely and encrypted)</li>
                <li>Limited, permitted data from your social account (such as recent posts, captions, or comments) to generate personalized insights about your communication style</li>
              </ul>
              <p className="text-sm italic">We only access publicly available or user-authorized content. We do not access private messages, friend lists, or other sensitive data.</p>
              <p className="text-sm"><strong>Important:</strong> Raw social content is processed transiently to generate summaries and is not stored permanently. Only the AI-generated summary (without identifying information) is retained.</p>

              <p><strong>Usage Data:</strong> We collect information about how you interact with our services, including pages visited, features used, and device information.</p>

              <p><strong>Cookies and Similar Technologies:</strong> We use cookies to maintain your session, remember preferences, and improve your experience.</p>

              <p><strong>Payment Information:</strong> If you subscribe to a paid plan, payment processing is handled by Stripe. We do not store your full credit card number.</p>
            </div>
          </section>

          {/* How We Use Your Data */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              How We Use Your Data
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p><strong>Personalization:</strong> We use your birth information and social data to generate personalized horoscopes, insights, connection briefs, and other astrological content.</p>

              <p><strong>Service Delivery:</strong> To provide, maintain, and improve our services.</p>

              <p><strong>Security and Abuse Prevention:</strong> To protect our users and platform from fraud, abuse, and security threats.</p>

              <p><strong>Billing:</strong> To process payments and manage your subscription.</p>

              <p><strong>Communication:</strong> To send you important service updates and, with your consent, promotional communications.</p>
            </div>
          </section>

          {/* AI Disclosure */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              AI Disclosure
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                Solara Insights uses artificial intelligence (powered by OpenAI) to generate personalized content including horoscopes, birth chart interpretations, connection insights, and social media summaries.
              </p>
              <p>
                When you request personalized content, we send relevant context (such as birth chart data or anonymized social content summaries) to OpenAI&apos;s API to generate your insights. We do not send personally identifiable information like your name or email to AI providers when generating content.
              </p>
              <p className="font-medium">
                AI-generated content is for entertainment and self-reflection purposes only. It is not medical, legal, financial, or professional advice.
              </p>
            </div>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              How We Share Your Data
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>We may share your data with the following parties:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>OpenAI:</strong> To generate AI-powered content (birth chart context, anonymized social summaries)</li>
                <li><strong>Supabase:</strong> Our database and authentication provider</li>
                <li><strong>Stripe:</strong> For payment processing</li>
                <li><strong>Social Media Platforms:</strong> As necessary to maintain OAuth connections (Facebook/Meta, Instagram, TikTok, X, Reddit)</li>
                <li><strong>Legal Compliance:</strong> When required by law or to protect our rights</li>
              </ul>
              <p className="font-semibold mt-4">
                We do not sell your personal data to third parties.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Data Retention
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                We retain your data for as long as necessary to provide our services and fulfill the purposes described in this policy.
              </p>
              <p>
                You may request deletion of your account and associated data at any time by contacting us at solara@solarainsights.com. Upon receiving a valid deletion request, we will delete or de-identify your personal data within 30 days, except where retention is required by law.
              </p>
            </div>
          </section>

          {/* User Controls */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Your Rights and Controls
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>You have the following rights regarding your data:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Disconnect Social Accounts:</strong> You can disconnect any connected social account at any time through your Settings. This immediately stops any further data collection from that account.</li>
                <li><strong>Access Your Data:</strong> Request a copy of the data we hold about you.</li>
                <li><strong>Delete Your Data:</strong> Request deletion of your account and all associated data.</li>
                <li><strong>Update Your Information:</strong> Modify your profile information at any time through Settings.</li>
              </ul>
              <p>To exercise these rights, contact us at solara@solarainsights.com.</p>
            </div>
          </section>

          {/* Security */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Security
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                We implement appropriate technical and organizational security measures to protect your personal data. This includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption of sensitive data (including OAuth tokens) at rest and in transit</li>
                <li>Secure authentication via Supabase Auth</li>
                <li>Regular security reviews and updates</li>
                <li>Access controls limiting who can access personal data</li>
              </ul>
              <p>
                While we strive to protect your data, no method of transmission or storage is 100% secure. We cannot guarantee absolute security.
              </p>
            </div>
          </section>

          {/* Children */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Children&apos;s Privacy
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                Solara Insights is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected data from a child under 13, please contact us immediately at solara@solarainsights.com and we will take steps to delete such information.
              </p>
            </div>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Changes to This Policy
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the &quot;Effective Date&quot; at the top. We encourage you to review this policy periodically.
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
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
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
