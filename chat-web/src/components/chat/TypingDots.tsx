export default function TypingDots() {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="status"
      aria-label="Assistente está digitando"
    >
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </span>
  )
}