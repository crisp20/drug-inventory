import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  // Allow saving a typed value that isn't in the list
  allowCustom?: boolean;
  // Tapping the selected option again clears it
  allowClear?: boolean;
};

// Searchable dropdown for picking one value from a fixed list
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
  allowClear = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const typed = search.trim();
  const exactMatch = options.some((o) => o.toLowerCase() === typed.toLowerCase());

  const choose = (option: string) => {
    onChange(allowClear && option === value ? "" : option);
    setSearch("");
    setOpen(false);
  };

  return (
    // modal keeps scrolling working inside dialogs
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-9 w-full justify-between whitespace-normal text-left font-normal"
        >
          <span className={cn("min-w-0 flex-1", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72">
            <CommandEmpty>No match found.</CommandEmpty>
            {allowCustom && typed && !exactMatch && (
              <CommandGroup>
                <CommandItem value={`__custom__ ${typed}`} onSelect={() => choose(typed)} className="cursor-pointer">
                  <Plus /> Use “{typed}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => choose(option)} className="cursor-pointer">
                  <Check className={cn(value === option ? "opacity-100" : "opacity-0")} />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
