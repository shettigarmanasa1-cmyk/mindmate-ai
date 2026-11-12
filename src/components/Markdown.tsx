import { useRef, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'

const remarkPlugins: Options['remarkPlugins'] = [remarkGfm, remarkMath]

// Math first, so formulas are drawn before code highlighting runs.
const rehypePlugins: Options['rehypePlugins'] = [
  [rehypeKatex, { throwOnError: false, strict: 'ignore' }],
  [rehypeHighlight, { ignoreMissing: true }],
]

// AI models often write \( ... \) and \[ ... \] for math. The renderer wants
// $ ... $ and $$ ... $$, so convert them. Code blocks are left untouched.
function normalizeMath(text: string) {
  return text
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g)
    .map((part, index) => {
      if (index % 2 === 1) return part
      return part
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => '\n$$\n' + m.trim() + '\n$$\n')
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => '$' + m.trim() + '$')
    })
    .join('')
}

// A code block with a Copy button.
function CodeBlock({ children }: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  async function copy() {
    const text = preRef.current?.innerText ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // The browser may block clipboard access. Nothing else to do.
    }
  }

  return (
    <div className="code-block">
      <button type="button" className="copy-btn" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={preRef}>{children}</pre>
    </div>
  )
}

interface Props {
  text: string
}

export default function Markdown({ text }: Props) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          pre: CodeBlock,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {normalizeMath(text)}
      </ReactMarkdown>
    </div>
  )
}
