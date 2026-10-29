import { Link } from 'react-router-dom'

/**
 * Renders the documented formatting subset, as elements rather than HTML.
 *
 * Supported, and described to the admin in the model's help text: a blank line
 * starts a paragraph, `## ` a heading, `### ` a sub-heading, `- ` a bullet,
 * `**bold**`, and `[text](url)`. Everything else is shown as written — so a
 * stray HTML tag appears as text instead of executing, which is the point.
 */
export function LegalProse({ body }: { body: string }) {
  const blocks: React.ReactNode[] = []
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let bullets: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(
      <p key={`p${blocks.length}`}>{inline(paragraph.join(' '))}</p>,
    )
    paragraph = []
  }
  const flushBullets = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`u${blocks.length}`} className="list-disc space-y-1.5 pl-5">
        {bullets.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') {
      flushBullets()
      flushParagraph()
    } else if (line.startsWith('### ')) {
      flushBullets()
      flushParagraph()
      blocks.push(
        <h3 key={`h3${blocks.length}`} className="pt-3 font-display text-[15px] font-semibold text-ink">
          {inline(line.slice(4))}
        </h3>,
      )
    } else if (line.startsWith('## ')) {
      flushBullets()
      flushParagraph()
      blocks.push(
        <h2 key={`h2${blocks.length}`} className="pt-5 font-display text-[19px] font-semibold text-ink">
          {inline(line.slice(3))}
        </h2>,
      )
    } else if (line.startsWith('- ')) {
      flushParagraph()
      bullets.push(line.slice(2))
    } else {
      flushBullets()
      paragraph.push(line)
    }
  }
  flushBullets()
  flushParagraph()

  return <>{blocks}</>
}

/**
 * `**bold**` and `[text](url)`, as elements. Nothing else is interpreted.
 * A link may be absolute (https, mailto) or a page of this site (`/privacy`),
 * which stays in the app.
 */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]*)\)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))
    if (match[1] !== undefined) {
      out.push(<strong key={out.length}>{match[1]}</strong>)
    } else if (match[3].startsWith('/')) {
      out.push(
        <Link key={out.length} to={match[3]} className="text-green hover:underline">
          {match[2]}
        </Link>,
      )
    } else {
      out.push(
        <a
          key={out.length}
          href={match[3]}
          className="text-green hover:underline"
          target={match[3].startsWith('http') ? '_blank' : undefined}
          rel={match[3].startsWith('http') ? 'noreferrer' : undefined}
        >
          {match[2]}
        </a>,
      )
    }
    last = pattern.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
