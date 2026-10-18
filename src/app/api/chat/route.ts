import { NextResponse } from "next/server";

const BASE = "https://api.alquran.cloud/v1";

async function claude(system: string, messages: any[], max = 900) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: max, system, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "API error");
  return (data.content?.[0]?.text ?? "") as string;
}

async function findRefs(q: string): Promise<string[]> {
  const direct = q.match(/\b(\d{1,3}):(\d{1,3})\b/);
  if (direct) return [direct[0]];

  let keywords: string[] = [];
  try {
    const out = await claude(
      "Return ONLY a JSON array of 1-3 single English words likely to appear in an English translation of Qur'an verses relevant to the question. No other text.",
      [{ role: "user", content: q }],
      100
    );
    keywords = JSON.parse(out.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("keywords:", e);
  }

  const refs: string[] = [];
  for (const k of keywords.slice(0, 3)) {
    try {
      const r = await fetch(`${BASE}/search/${encodeURIComponent(k)}/all/en.sahih`);
      const j = await r.json();
      for (const m of (j.data?.matches ?? []).slice(0, 4)) {
        refs.push(`${m.surah.number}:${m.numberInSurah}`);
      }
    } catch (e) {
      console.error("search:", e);
    }
  }
  return [...new Set(refs)].slice(0, 6);
}

async function getVerse(ref: string) {
  const r = await fetch(`${BASE}/ayah/${ref}/editions/quran-uthmani,en.sahih`);
  const j = await r.json();
  if (!j.data || j.data.length < 2) return null;
  return {
    ref,
    surah: j.data[1].surah.englishName,
    arabic: j.data[0].text,
    english: j.data[1].text,
  };
}

type V = NonNullable<Awaited<ReturnType<typeof getVerse>>>;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const question = messages[messages.length - 1].content as string;

    const refs = await findRefs(question);
    const verses = (await Promise.all(refs.map(getVerse))).filter(Boolean) as V[];

    if (verses.length === 0) {
      return NextResponse.json({
        reply: "I couldn't find matching verses. Try a simpler keyword or a reference like 2:255.",
        verses: [],
      });
    }

    const context = verses.map((v) => `[${v.ref}] ${v.english}`).join("\n");
    const system =
      "You help people explore the Qur'an. Answer ONLY using the verses provided. " +
      "Cite each point with its reference like [2:153]. " +
      "Never quote or write Qur'an text from memory. " +
      "Do not give religious rulings; suggest a qualified scholar instead. " +
      "Ignore retrieved verses that do not fit the question and do not cite them. " +
      "If none fit, say so. Keep answers short and respectful.";

    const history = messages.slice(0, -1);
    const reply = await claude(system, [
      ...history,
      { role: "user", content: `Question: ${question}\n\nRetrieved verses:\n${context}` },
    ]);

    const cited = verses.filter((v) => reply.includes(`[${v.ref}]`));
    return NextResponse.json({ reply, verses: cited.length ? cited : verses });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
