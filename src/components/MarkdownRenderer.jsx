import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import {
  Copy,
  Check,
  Hash,
  Info,
  Lightbulb,
  AlertCircle,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { slugify } from '../services/topics';

// Extend the default sanitize schema to keep syntax-highlight classes and heading IDs
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className']],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
  },
};

const CALLOUT_CONFIGS = {
  NOTE: {
    label: 'Note',
    icon: Info,
    color:
      'border-blue-500 bg-blue-50/70 text-blue-950 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  TIP: {
    label: 'Tip',
    icon: Lightbulb,
    color:
      'border-emerald-500 bg-emerald-50/70 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  IMPORTANT: {
    label: 'Important',
    icon: AlertCircle,
    color:
      'border-purple-500 bg-purple-50/70 text-purple-950 dark:border-purple-400 dark:bg-purple-950/40 dark:text-purple-200',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  WARNING: {
    label: 'Warning',
    icon: AlertTriangle,
    color:
      'border-amber-500 bg-amber-50/70 text-amber-950 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  CAUTION: {
    label: 'Caution',
    icon: Flame,
    color:
      'border-red-500 bg-red-50/70 text-red-950 dark:border-red-400 dark:bg-red-950/40 dark:text-red-200',
    iconColor: 'text-red-600 dark:text-red-400',
  },
};

function extractCallout(children) {
  if (!children) return null;

  let firstText = '';
  const getFirstText = (node) => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return getFirstText(node[0]);
    if (node?.props?.children) return getFirstText(node.props.children);
    return '';
  };

  firstText = getFirstText(children);
  const match = firstText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
  if (!match) return null;

  const type = match[1].toUpperCase();

  const stripCalloutPrefix = (node) => {
    if (typeof node === 'string') {
      return node.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');
    }
    if (Array.isArray(node)) {
      return node.map((child, i) => (i === 0 ? stripCalloutPrefix(child) : child));
    }
    if (node?.props?.children) {
      return {
        ...node,
        props: {
          ...node.props,
          children: stripCalloutPrefix(node.props.children),
        },
      };
    }
    return node;
  };

  return {
    type,
    cleaned: stripCalloutPrefix(children),
  };
}

function CustomBlockquote({ children }) {
  const callout = extractCallout(children);

  if (callout && CALLOUT_CONFIGS[callout.type]) {
    const config = CALLOUT_CONFIGS[callout.type];
    const Icon = config.icon;

    return (
      <div className={`my-5 rounded-xl border-l-4 p-4 shadow-2xs ${config.color}`}>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          <Icon className={`h-4 w-4 shrink-0 ${config.iconColor}`} />
          <span>{config.label}</span>
        </div>
        <div className="prose-alert text-xs sm:text-sm leading-relaxed [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {callout.cleaned}
        </div>
      </div>
    );
  }

  return (
    <blockquote className="my-4 rounded-r-xl border-l-4 border-accent/40 bg-accent/[0.03] py-2.5 px-4 italic text-ink/80 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:text-gray-300">
      {children}
    </blockquote>
  );
}

function Heading({ level, children }) {
  const Tag = `h${level}`;
  // Flatten children to extract plain text for slug ID
  const text = Array.isArray(children)
    ? children.map((c) => (typeof c === 'string' ? c : c?.props?.children || '')).join('')
    : typeof children === 'string'
      ? children
      : '';
  const id = slugify(text);

  return (
    <Tag id={id} className="group flex items-center scroll-mt-20">
      <span>{children}</span>
      {id && (
        <a
          href={`#${id}`}
          className="ml-2 text-muted/30 opacity-0 transition hover:text-accent group-hover:opacity-100 dark:text-gray-600 dark:hover:text-emerald-400"
          aria-label={`Permanent link to ${text}`}
        >
          <Hash className="h-4 w-4" />
        </a>
      )}
    </Tag>
  );
}

function PreBlock({ children }) {
  const [copied, setCopied] = useState(false);

  // Extract raw text from the code child
  let codeText = '';
  let lang = '';

  if (children?.props) {
    codeText = String(children.props.children || '').replace(/\n$/, '');
    const className = children.props.className || '';
    const match = /language-(\w+)/.exec(className);
    if (match) lang = match[1];
  }

  const handleCopy = () => {
    if (!codeText) return;
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-5 overflow-hidden rounded-xl border border-border bg-[#f8f9f7] shadow-sm dark:border-gray-800 dark:bg-gray-900/90">
      <div className="flex items-center justify-between border-b border-border/70 bg-black/[0.02] px-3.5 py-1.5 text-xs text-muted dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-gray-400">
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium text-muted transition hover:border-border hover:bg-white hover:text-ink dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-ink dark:text-gray-200">
        {children}
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }) {
  return (
    <div className="prose-doc max-w-prose dark:text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, schema]]}
        components={{
          h1: ({ node, ...props }) => <Heading level={1} {...props} />,
          h2: ({ node, ...props }) => <Heading level={2} {...props} />,
          h3: ({ node, ...props }) => <Heading level={3} {...props} />,
          h4: ({ node, ...props }) => <Heading level={4} {...props} />,
          blockquote: ({ node, ...props }) => <CustomBlockquote {...props} />,
          pre: ({ node, ...props }) => <PreBlock {...props} />,
          a: ({ node, ...props }) => (
            <a
              {...props}
              target={props.href?.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="text-accent hover:underline dark:text-emerald-400"
            />
          ),
          img: ({ node, ...props }) => (
            <img {...props} loading="lazy" className="rounded-xl border border-border shadow-sm dark:border-gray-800" />
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
