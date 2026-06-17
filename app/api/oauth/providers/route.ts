const allowedProviders = new Set(["google", "x"])

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { provider?: string }
  const provider = body.provider

  if (!provider || !allowedProviders.has(provider)) {
    return Response.json({ message: "Unsupported OAuth provider." }, { status: 400 })
  }

  return Response.json({ provider, enabled: true })
}
