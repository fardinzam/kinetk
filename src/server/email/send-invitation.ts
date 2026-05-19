import "server-only";

import { getResendClient } from "./client";

type SendInvitationParams = {
  toEmail: string;
  workspaceName: string;
  inviterEmail: string;
  acceptUrl: string;
};

export async function sendInvitationEmail(
  params: SendInvitationParams,
): Promise<void> {
  await getResendClient().emails.send({
    from: "Kinetk <noreply@kinetk.com>",
    to: params.toEmail,
    subject: `You've been invited to ${params.workspaceName} on Kinetk`,
    text: [
      `${params.inviterEmail} has invited you to join ${params.workspaceName} on Kinetk.`,
      ``,
      `Accept the invitation:`,
      `${params.acceptUrl}`,
      ``,
      `This link expires in 7 days. If you did not expect this invitation, you can ignore this email.`,
    ].join("\n"),
  });
}
