import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { PRIVACY_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data Deletion Instructions",
  description: "How to request deletion of personal data processed by KK WABA.",
};

export default function DataDeletionPage() {
  return (
    <LegalPageShell
      title="Data Deletion Instructions"
      description="Use this page to request deletion of personal data processed by KK WABA, including data received through a connected WhatsApp Business account."
    >
      <section>
        <h2>1. Before you submit a request</h2>
        <p>
          KK WABA is used by businesses to manage their own customer relationships. The right place to make a request depends on whose data is involved. If you are a customer who received a message from a business, contact that business first. The business controls its customer records and is best placed to identify and action your request. If you are a KK WABA account holder, workspace member, or WhatsApp Business account administrator, you may submit a request directly to us using the steps below.
        </p>
      </section>

      <section>
        <h2>2. Request deletion from KK WABA</h2>
        <p>
          To request deletion, email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> with the subject <strong>“Data Deletion Request”</strong>. Do not include passwords, access tokens, full message histories, or other sensitive information in the request.
        </p>
        <p>After a private channel is established, include:</p>
        <ul>
          <li>the email address associated with your KK WABA account, if you have one;</li>
          <li>your name and the name of the organisation or workspace, if applicable;</li>
          <li>the WhatsApp Business phone number or WhatsApp Business Account ID connected to the workspace, if applicable;</li>
          <li>a clear description of the data you want deleted; and</li>
          <li>any details needed to locate the data, such as the relevant date range or customer phone number.</li>
        </ul>
      </section>

      <section>
        <h2>3. Verification and timing</h2>
        <p>
          To protect personal information, we will verify that the requester is authorised before acting. We may ask you to confirm control of the account email, workspace, or connected WhatsApp Business account. We aim to acknowledge verified requests within 7 days and complete them within 30 days, unless a longer period is permitted or required by law. If more time is needed, we will explain why.
        </p>
      </section>

      <section>
        <h2>4. What we delete</h2>
        <p>For a verified account-deletion request, we will delete or irreversibly anonymise, as applicable:</p>
        <ul>
          <li>the requested KK WABA user profile and account information;</li>
          <li>WhatsApp Business connection details and stored connection credentials associated with the request;</li>
          <li>workspace records, contacts, messages, media references, notes, automations, and other CRM data that the verified requester is authorised to delete; and</li>
          <li>associated personal information in active application systems.</li>
        </ul>
        <p>
          We will also disconnect the affected WhatsApp Business integration where that is part of the verified request. Information may remain temporarily in secure backups until those backups are overwritten according to our retention schedule. We may retain a limited record where necessary to comply with law, resolve disputes, prevent fraud, enforce agreements, or protect the service.
        </p>
      </section>

      <section>
        <h2>5. Data held by Meta, WhatsApp, or a business</h2>
        <p>
          Deleting data from KK WABA does not automatically delete information that Meta, WhatsApp, a Business User, an AI provider, or another independent service holds under its own policies. To request deletion of data held by Meta or WhatsApp directly, use the privacy controls and support channels available through the relevant Meta or WhatsApp product. If you are an End Customer, contact the business that communicated with you so it can action data held in its own systems.
        </p>
      </section>

      <section>
        <h2>6. Other privacy requests</h2>
        <p>
          You may use the same process to request access to, correction of, or information about personal data processed by KK WABA. See our <Link href="/privacy-policy">Privacy Policy</Link> for more information about your privacy rights and how we process information.
        </p>
      </section>
    </LegalPageShell>
  );
}
