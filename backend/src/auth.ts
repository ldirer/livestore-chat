import type { MagicLinkService } from './magicLink.ts'
import type { tables as userTables } from './schema/user.ts'

type UserType = typeof userTables.user.Type

export async function sendLoginLink(
  magicLinks: MagicLinkService,
  user: UserType,
) {
  const loginUrl = await magicLinks.createMagicLink(user)

  const emailContent = `Click this link to log in: ${loginUrl}`

  try {
    await sendEmail(emailContent, user.email)
  } catch (error) {
    console.error('Failed to send login link:', error)
    throw new Error('EmailCouldNotBeSent')
  }
}

// stub function, not implemented for now.
async function sendEmail(content: string, email: string) {
  // logging the email to stdout (before sending it) so we can click the link in development.
  console.log(`sending email to ${email}: ${content}`)
}
