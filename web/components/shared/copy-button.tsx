"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({
        title: t('shared.copied'),
        description: t('shared.copiedToClipboard', { label }),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: t('shared.failedToCopy'),
        description: t('sms.tryAgain'),
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={copyToClipboard}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
