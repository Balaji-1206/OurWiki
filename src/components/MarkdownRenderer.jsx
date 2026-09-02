import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Extend the default sanitize schema just enough to keep syntax-highlight
// classes (rehype-highlight adds classNames like "hljs-keyword") — anything
// not explicitly allowed here (script tags, event handlers, style attrs,
// javascript: URLs, raw <iframe>/<object>, etc.) is stripped, not escaped.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className']],
  },
};

export default function MarkdownRenderer({ content }) {
  return (
    <div className="prose-doc max-w-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, schema]]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target={props.href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" />
          ),
          img: ({ node, ...props }) => <img {...props} loading="lazy" className="rounded-md border border-border" />,
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
