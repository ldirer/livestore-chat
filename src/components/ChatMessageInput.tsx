import { useState } from 'react';

interface ChatMessageInputProps {
  onSubmit: (message: {content: string}) => void;
}

export function ChatMessageInput({ onSubmit }: ChatMessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit({content: message.trim()});
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Join the discussion..."
      />
      <button type="button" onClick={handleSubmit} title={"Send message (CTRL+Enter)"}>Send</button>
    </div>
  );
}

