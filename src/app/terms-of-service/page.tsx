import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { PRIVACY_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing access to and use of KK WABA.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description="These terms govern access to and use of the KK WABA WhatsApp Business CRM service."
    >
      <section>
        <h2>1. Agreement to these terms</h2>
        <p>
          By creating an account, connecting a WhatsApp Business account, or using KK WABA, you agree to these Terms of Service and our <Link href="/privacy-policy">Privacy Policy</Link>. If you use KK WABA for an organisation, you represent that you have authority to bind that organisation. If you do not agree, do not use the service.
        </p>
      </section>

      <section>
        <h2>2. The service</h2>
        <p>
          KK WABA provides a workspace for managing WhatsApp Business Platform conversations, contacts, campaigns, automations, and related customer-relationship workflows. The service integrates with Meta products and the WhatsApp Business Platform, but KK WABA is an independent product and is not affiliated with, endorsed by, or sponsored by Meta or WhatsApp.
        </p>
      </section>

      <section>
        <h2>3. Accounts and authorised users</h2>
        <ul>
          <li>You must provide accurate account information and keep it current.</li>
          <li>You are responsible for safeguarding your credentials and for all activity under your account and workspace.</li>
          <li>You must promptly notify us if you suspect unauthorised access or a security incident involving your account.</li>
          <li>Workspace owners and administrators are responsible for inviting, managing, and removing their authorised team members.</li>
        </ul>
      </section>

      <section>
        <h2>4. WhatsApp and Meta requirements</h2>
        <p>
          Your use of any Meta or WhatsApp integration is also subject to the applicable Meta Platform Terms, WhatsApp Business Terms, WhatsApp Business Messaging Policy, Meta policies, and all applicable laws. You are responsible for obtaining and maintaining the permissions, notices, consents, and opt-ins required to contact End Customers and for using approved templates when required.
        </p>
        <p>
          You must not use the service to send spam, unlawful, deceptive, abusive, discriminatory, infringing, or harmful content; circumvent Meta or WhatsApp restrictions; or collect, process, or share data in a way that violates applicable law or platform policy. We may suspend or limit use of an integration where reasonably necessary to protect the service, comply with a platform requirement, or address suspected misuse.
        </p>
      </section>

      <section>
        <h2>5. Your data and responsibilities</h2>
        <p>
          You retain responsibility for the content, contact information, messages, templates, and other data you submit to or process through your workspace (“Customer Data”). You grant us a limited right to process Customer Data solely to operate, secure, support, and improve the service in accordance with these terms and our Privacy Policy.
        </p>
        <p>
          You represent that you have all rights, notices, consents, and legal bases necessary to upload, use, and process Customer Data. You are responsible for responding to End Customer privacy requests relating to your customer relationship and for maintaining any retention policy that applies to your data.
        </p>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You must not, and must not permit anyone to:</p>
        <ul>
          <li>use the service in violation of law, regulation, third-party rights, or applicable platform terms;</li>
          <li>send unsolicited messages, conduct phishing or fraud, or use deceptive identities or content;</li>
          <li>introduce malware, interfere with the service, probe for vulnerabilities, or bypass security or access controls;</li>
          <li>reverse engineer, scrape, copy, or create a competing service from the service except where prohibited by law;</li>
          <li>use data obtained through the service to build profiles or make decisions in a way prohibited by law or Meta policy; or</li>
          <li>use the service in a manner likely to damage the reputation, availability, or security of KK WABA, Meta, WhatsApp, or another user.</li>
        </ul>
      </section>

      <section>
        <h2>7. Third-party services and AI features</h2>
        <p>
          The service may rely on third-party services, including Meta, WhatsApp, hosting providers, and optional AI providers. Your use of those services may be governed by their own terms and privacy policies. If you enable an AI provider, you are responsible for reviewing that provider&apos;s terms and ensuring that your use of its features is appropriate for your Customer Data. AI-generated output may be inaccurate and should be reviewed by a qualified human before use.
        </p>
      </section>

      <section>
        <h2>8. Suspension and termination</h2>
        <p>
          You may stop using the service at any time. We may suspend or terminate access if we reasonably believe you have violated these terms, created a security risk, or if suspension is required by law or an applicable platform. On termination, your right to use the service ends. You may request deletion of account information as described in our <Link href="/data-deletion">Data Deletion Instructions</Link>, subject to the retention terms in our Privacy Policy.
        </p>
      </section>

      <section>
        <h2>9. Disclaimers</h2>
        <p>
          The service is provided on an “as is” and “as available” basis to the fullest extent permitted by law. We do not guarantee that the service will be uninterrupted, error-free, secure, or compatible with every use case. We do not control Meta, WhatsApp, telecommunications providers, internet providers, or third-party services, and are not responsible for their availability, actions, or policy decisions.
        </p>
      </section>

      <section>
        <h2>10. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, KK WABA and its operators, contributors, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenue, goodwill, data, or business opportunities arising out of or related to the service. Nothing in these terms excludes liability that cannot be excluded under applicable law.
        </p>
      </section>

      <section>
        <h2>11. Changes to the service or terms</h2>
        <p>
          We may modify the service or these terms from time to time. Material changes will be posted on this page with an updated effective date. Continued use after the updated terms take effect constitutes acceptance of the revised terms.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          For questions about these terms, email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Do not send account credentials, access tokens, personal data, or confidential customer information by email.
        </p>
      </section>
    </LegalPageShell>
  );
}
