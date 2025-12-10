
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { KeyboardEvent, useState } from "react";

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value = [], onChange, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        if (!value.includes(inputValue.trim())) {
          onChange([...value, inputValue.trim()]);
        }
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-sm py-1">
          {tag}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
            onClick={() => removeTag(tag)}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">امسح {tag}</span> {/* Remove -> امسح */}
          </Button>
        </Badge>
      ))}
      <Input
        className="flex-1 border-none shadow-none focus-visible:ring-0 p-0 h-8 min-w-[120px]"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
      />
    </div>
  );
}
