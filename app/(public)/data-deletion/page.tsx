import { Card, CardContent } from "@/components/ui/card";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | Solara Insights",
  description: "Learn how to delete your data from Solara Insights.",
};

export default function DataDeletionPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Solara Logo - subtle */}
      <div className="flex justify-center items-center pt-2 pb-4">
        <SolaraLogo />
      </div>

      <h1 className="text-4xl font-bold text-center mb-4">Data Deletion Instructions</h1>
      <p className="text-center text-accent-ink/60 mb-12">
        How to delete your data from Solara Insights
      </p>

      <Card className="p-8 md:p-12">
        <CardContent className="space-y-10 p-0">
          {/* Introduction */}
          <section>
            <p className="text-lg text-accent-ink/80 leading-relaxed">
              At Solara Insights, we respect your right to control your personal data. This page
              explains how you can delete your data from our service.
            </p>
          </section>

          {/* Option 1: In-App Deletion */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Option 1: Delete via Settings (Recommended)
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                The easiest way to delete your account and all associated data is through your
                account settings:
              </p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Sign in to your Solara Insights account</li>
                <li>Navigate to Settings</li>
                <li>Scroll down to the "Danger Zone" section</li>
                <li>Click "Delete Account"</li>
                <li>Confirm by typing DELETE and entering your password</li>
              </ol>
              <p className="text-sm italic">
                This will permanently delete your account and all associated data, including your
                profile, birth information, connected social accounts, and any generated insights.
              </p>
            </div>
          </section>

          {/* Option 2: Disconnect Social Accounts */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Option 2: Disconnect Social Accounts Only
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                If you only want to disconnect your social media accounts without deleting your
                entire Solara account:
              </p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Sign in to your Solara Insights account</li>
                <li>Navigate to Settings</li>
                <li>Find the "Connected Accounts" section</li>
                <li>Click "Disconnect" next to the social account you want to remove</li>
              </ol>
              <p className="text-sm italic">
                This will delete the OAuth tokens and any social data summaries associated with
                that account, while keeping your Solara account active.
              </p>
            </div>
          </section>

          {/* Option 3: Via Facebook */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Option 3: Delete via Facebook
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                If you connected Facebook to Solara Insights, you can also request data deletion
                through Facebook:
              </p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Go to{" "}
                  <a
                    href="https://www.facebook.com/settings?tab=applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-gold hover:underline"
                  >
                    Facebook Settings &gt; Apps and Websites
                  </a>
                </li>
                <li>Find "Solara Insights" in your connected apps</li>
                <li>Click "Remove" and select "Delete all data associated with Solara"</li>
              </ol>
              <p className="text-sm italic">
                Facebook will notify us to delete your data. You can check the status of your
                deletion request using the confirmation link provided.
              </p>
            </div>
          </section>

          {/* Option 4: Contact Us */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              Option 4: Contact Support
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>
                If you're unable to access your account or prefer manual assistance, you can
                request data deletion by contacting us directly:
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:solara@solarainsights.com"
                  className="text-accent-gold hover:underline"
                >
                  solara@solarainsights.com
                </a>
              </p>
              <p className="text-sm italic">
                Please include the email address associated with your account. We will verify your
                identity and process your request within 30 days.
              </p>
            </div>
          </section>

          {/* What Gets Deleted */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-accent-gold">
              What Data Gets Deleted
            </h2>
            <div className="space-y-4 text-accent-ink/80 leading-relaxed">
              <p>When you delete your account, we permanently remove:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your profile information (name, email, preferences)</li>
                <li>Birth date, time, and location data</li>
                <li>Connected social account tokens and credentials</li>
                <li>Social insights summaries and generated content</li>
                <li>Soul Path readings and astrological data</li>
                <li>Connection profiles you've created</li>
                <li>Daily briefs and Space Between reports</li>
                <li>Your Stripe subscription (if applicable)</li>
              </ul>
              <p className="text-sm italic">
                Note: We may retain anonymized, aggregated data that cannot be linked back to you
                for analytics purposes. This data contains no personal identifiers.
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
                After you request deletion, your data is permanently removed from our active
                systems immediately. Some data may persist in encrypted backups for up to 30 days
                before being automatically purged.
              </p>
              <p>
                We do not sell, rent, or share your personal data with third parties for marketing
                purposes.
              </p>
            </div>
          </section>

          {/* Links */}
          <section className="border-t border-border-subtle pt-8">
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <Link href="/privacy" className="text-accent-gold hover:underline">
                Privacy Policy
              </Link>
              <span className="text-accent-ink/30">|</span>
              <Link href="/terms" className="text-accent-gold hover:underline">
                Terms of Service
              </Link>
              <span className="text-accent-ink/30">|</span>
              <a
                href="mailto:solara@solarainsights.com"
                className="text-accent-gold hover:underline"
              >
                Contact Support
              </a>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
