import { createAuthServerClient, getOrigin } from "@/lib/auth/server"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = body.email?.trim()

    if (!email) {
      return Response.json({ message: "Email is required." }, { status: 400 })
    }

    const client = createAuthServerClient()
    const redirectTo = new URL("/sign-in", getOrigin(request)).toString()
    const { data, error } = await client.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      return Response.json(
        { error: error.code, message: error.message || "Could not resend verification code." },
        { status: error.status || 400 }
      )
    }

    return Response.json(data || { success: true })
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Could not resend verification code." },
      { status: 500 }
    )
  }
}
