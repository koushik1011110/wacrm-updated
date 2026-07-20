import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { LEGAL_ENTITY, PRIVACY_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How KK WABA collects, uses, protects, and deletes personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description="This policy explains how KK WABA handles personal information when you use our WhatsApp Business CRM and related services."
    >
      <section>
        <h2>1. Who this policy applies to</h2>
        <p>
          KK WABA is a workspace for businesses to manage customer conversations through the WhatsApp Business Platform. In this policy, “KK WABA,” “we,” “us,” and “our” refer to {LEGAL_ENTITY}, the operator of the KK WABA service. “Business User” means a person or organisation that creates or administers a KK WABA workspace. “End Customer” means a person who communicates with a Business User through WhatsApp.
        </p>
        <p>
          For Business User account information, KK WABA generally acts as the controller. For End Customer information that a Business User chooses to process through the service, that Business User is the controller and KK WABA processes the information on its documented instructions as a service provider.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <p>We collect only the information needed to provide, secure, and improve the service, including:</p>
        <ul>
          <li><strong>Account information:</strong> name, email address, authentication details, profile settings, team role, and workspace information.</li>
          <li><strong>WhatsApp Business connection information:</strong> WhatsApp Business Account and phone-number identifiers, display-name and account-status information, and credentials or tokens needed to operate the connection. Sensitive connection credentials are encrypted at rest.</li>
          <li><strong>Customer relationship information:</strong> contact names, phone numbers, email addresses, company details, tags, notes, and other information a Business User adds to the workspace.</li>
          <li><strong>Message and media information:</strong> messages, message metadata, delivery status, attachments, and other content exchanged through a connected WhatsApp Business account.</li>
          <li><strong>Service and security information:</strong> audit records, activity history, IP address and device/browser information, error logs, and information needed to prevent abuse and protect the service.</li>
          <li><strong>Optional AI information:</strong> when a Business User enables an AI feature, the prompt, relevant conversation context, and selected knowledge-base content needed to generate a response.</li>
        </ul>
      </section>

      <section>
        <h2>3. Information received from Meta and WhatsApp</h2>
        <p>
          When a Business User connects a WhatsApp Business account through Meta&apos;s Embedded Signup flow or otherwise authorises our integration, we receive the information and permissions Meta makes available for that connection. This can include business and phone-number identifiers, business profile details, connection status, scoped access credentials, and WhatsApp Business Platform events such as inbound messages and delivery updates.
        </p>
        <p>
          We use this information solely to establish and operate the authorised WhatsApp Business connection, deliver the requested CRM features, maintain security, and comply with applicable law and Meta&apos;s platform terms. We do not use WhatsApp Business Platform data for advertising profiles, sell it, or disclose it for another party&apos;s independent marketing purposes.
        </p>
      </section>

      <section>
        <h2>4. How we use information</h2>
        <ul>
          <li>Provide the shared inbox, contact management, broadcasts, automations, flows, and other requested features.</li>
          <li>Authenticate users, manage teams and permissions, and provide support.</li>
          <li>Maintain the reliability, integrity, and security of the service, including fraud prevention and troubleshooting.</li>
          <li>Send service-related notices, such as security, account, or policy updates.</li>
          <li>Comply with legal obligations and enforce our <Link href="/terms-of-service">Terms of Service</Link>.</li>
          <li>Improve the service using aggregated or de-identified information where permitted by law.</li>
        </ul>
      </section>

      <section>
        <h2>5. Legal bases</h2>
        <p>
          Where applicable law requires a legal basis, we process Business User information to perform our contract with you, to pursue legitimate interests in operating and securing the service, to comply with legal obligations, and with consent where consent is required. Business Users are responsible for establishing an appropriate legal basis for their collection and use of End Customer data.
        </p>
      </section>

      <section>
        <h2>6. How information is shared</h2>
        <p>We may share information only as necessary to operate the service:</p>
        <ul>
          <li><strong>With the relevant Business User and authorised workspace members,</strong> according to their role permissions.</li>
          <li><strong>With Meta and WhatsApp,</strong> to send and receive WhatsApp Business Platform messages and administer the authorised connection.</li>
          <li><strong>With service providers,</strong> such as hosting, database, storage, authentication, and security providers, who process data for us under appropriate contractual and security safeguards.</li>
          <li><strong>With an AI provider selected by a Business User,</strong> only when that Business User enables an AI feature and only for the content required to fulfil that request.</li>
          <li><strong>When legally required,</strong> or when necessary to protect the rights, safety, and security of KK WABA, our users, or others.</li>
        </ul>
        <p>We do not sell personal information or share it for cross-context behavioural advertising.</p>
      </section>

      <section>
        <h2>7. Data retention and deletion</h2>
        <p>
          We retain information for as long as needed to provide the service, meet legal and security obligations, resolve disputes, and enforce agreements. Business Users can delete certain workspace records from the product. A verified request to delete an account or personal data can also be made using our <Link href="/data-deletion">Data Deletion Instructions</Link>.
        </p>
        <p>
          When deletion is completed, we delete or irreversibly anonymise the information from active systems, subject to limited retention in secure backups, legal requirements, fraud prevention, and information that cannot be linked to an individual. Data held independently by Meta, WhatsApp, or another Business User is governed by that party&apos;s own policies and controls.
        </p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>
          We use reasonable administrative, technical, and organisational measures designed to protect personal information. These measures include access controls, role-based permissions, encrypted storage for sensitive WhatsApp connection credentials, transport encryption, and monitoring designed to detect unauthorised access. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>9. Your choices and rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or receive a copy of your personal information, and to withdraw consent where processing is based on consent. Business Users may update account and workspace information in the service. To exercise a privacy right or request deletion, follow our <Link href="/data-deletion">Data Deletion Instructions</Link>.
        </p>
        <p>
          If you are an End Customer who communicated with a business through WhatsApp, please contact that business first. The business is normally responsible for responding to requests involving its customer relationship data. We will support the Business User as required by applicable law and our agreement with them.
        </p>
      </section>

      <section>
        <h2>10. International transfers</h2>
        <p>
          Information may be processed in countries other than the one in which it was collected. When required, we use appropriate safeguards for international transfers, such as contractual protections, and work with service providers that maintain suitable data-protection commitments.
        </p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>
          The service is not directed to children and is intended for business use. We do not knowingly collect personal information from children in violation of applicable law. If you believe a child has provided personal information to us, please submit a request through our <Link href="/data-deletion">Data Deletion Instructions</Link>.
        </p>
      </section>

      <section>
        <h2>12. Changes and contact</h2>
        <p>
          We may update this policy to reflect changes to the service, legal requirements, or our data practices. We will post the updated version here and revise the “Last updated” date. For privacy questions or requests, email us at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Do not send passwords, access tokens, or full message histories by email.
        </p>
      </section>
    </LegalPageShell>
  );
}
