'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  MessageSquare,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Calendar,
  Headphones,
  Bot,
  FileText,
  UserCheck,
} from 'lucide-react';

interface MemberOption {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
}
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WelcomeMenuConfig, WelcomeMenuButton } from '@/app/api/ai/welcome-menu/route';

interface AiWelcomeMenuProps {
  canEdit?: boolean;
}

const PRESETS: Record<string, WelcomeMenuConfig> = {
  production: {
    enabled: true,
    header_text: 'Buddies Production',
    body_text:
      'Namaste! 🙏 Welcome to Buddies Production.\n\nAapki behtar sahayata ke liye, kripya confirm karein ki aap kis regarding connect karna chahte hain?',
    footer_text: 'Please select an option below',
    buttons: [
      {
        id: 'buddies_intent_rental',
        title: 'Rental Booking',
        action: 'booking',
        reply_text: '',
      },
      {
        id: 'buddies_intent_inquiry',
        title: 'General Inquiry',
        action: 'ai_inquiry',
        reply_text: 'Please let us know your query, how can we help you today?',
      },
      {
        id: 'buddies_intent_team',
        title: 'Talk to Team',
        action: 'talk_to_team',
        reply_text:
          'Ji bilkul! 🙏 Aapki chat humari support team ko forward kar di gayi hai. Humare team member aapse jald hi direct baat karenge. Dhanyawad!',
      },
    ],
  },
  services: {
    enabled: true,
    header_text: 'Customer Care',
    body_text:
      'Hello! 🙏 Welcome. We are happy to help you. Please select what you would like to do:',
    footer_text: 'Select an option below',
    buttons: [
      {
        id: 'intent_book_service',
        title: 'Book Appointment',
        action: 'booking',
        reply_text: '',
      },
      {
        id: 'intent_faq_inquiry',
        title: 'Service Inquiry',
        action: 'ai_inquiry',
        reply_text: 'How can we help you today? Please tell us your question.',
      },
      {
        id: 'intent_contact_support',
        title: 'Talk to Support',
        action: 'talk_to_team',
        reply_text: 'Our team is here to assist. An agent will connect with you shortly!',
      },
    ],
  },
  support: {
    enabled: true,
    header_text: 'Welcome',
    body_text:
      'Hello! Thank you for contacting us. Please choose an option so we can assist you faster:',
    footer_text: 'Tap a button below',
    buttons: [
      {
        id: 'intent_products',
        title: 'Products & Pricing',
        action: 'ai_inquiry',
        reply_text: 'Please tell us which product or pricing you are inquiring about:',
      },
      {
        id: 'intent_order_status',
        title: 'Book Order',
        action: 'booking',
        reply_text: '',
      },
      {
        id: 'intent_human_agent',
        title: 'Talk to Agent',
        action: 'talk_to_team',
        reply_text: 'Forwarding to an available team member. Please hold on!',
      },
    ],
  },
};

export function AiWelcomeMenu({ canEdit = true }: AiWelcomeMenuProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<WelcomeMenuButton[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [menuRes, membersRes] = await Promise.all([
          fetch('/api/ai/welcome-menu'),
          fetch('/api/account/members', { cache: 'no-store' }),
        ]);

        const data = await menuRes.json().catch(() => ({}));
        if (!cancelled && data.config) {
          setEnabled(Boolean(data.config.enabled));
          setHeaderText(data.config.header_text || '');
          setBodyText(data.config.body_text || '');
          setFooterText(data.config.footer_text || '');
          setButtons(data.config.buttons || []);
        }

        const membersData = await membersRes.json().catch(() => ({}));
        if (!cancelled && Array.isArray(membersData.members)) {
          setMembers(membersData.members);
        }
      } catch {
        // Silently fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApplyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    setEnabled(preset.enabled);
    setHeaderText(preset.header_text);
    setBodyText(preset.body_text);
    setFooterText(preset.footer_text);
    setButtons([...preset.buttons]);
    toast.success(`Applied "${key}" preset template`);
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) {
      toast.error('WhatsApp allows a maximum of 3 interactive buttons');
      return;
    }
    const nextIdx = buttons.length + 1;
    setButtons([
      ...buttons,
      {
        id: `intent_btn_${Date.now()}_${nextIdx}`,
        title: `Option ${nextIdx}`,
        action: 'ai_inquiry',
        reply_text: '',
      },
    ]);
  };

  const handleRemoveButton = (idx: number) => {
    if (buttons.length <= 1 && enabled) {
      toast.error('At least 1 button is required when welcome menu is enabled');
      return;
    }
    setButtons(buttons.filter((_, i) => i !== idx));
  };

  const handleUpdateButton = (
    idx: number,
    field: keyof WelcomeMenuButton,
    value: string
  ) => {
    const updated = [...buttons];
    updated[idx] = { ...updated[idx], [field]: value };
    setButtons(updated);
  };

  const handleSave = async () => {
    if (enabled && buttons.length === 0) {
      toast.error('Please add at least 1 button');
      return;
    }
    if (enabled && !bodyText.trim()) {
      toast.error('Please enter a welcome message body');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ai/welcome-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          header_text: headerText,
          body_text: bodyText,
          footer_text: footerText,
          buttons,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Welcome Intent Buttons saved successfully!');
      } else {
        toast.error(data.error || 'Failed to save welcome menu');
      }
    } catch {
      toast.error('Network error while saving welcome menu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading welcome menu settings…
      </div>
    );
  }

  const disabled = !canEdit || saving;

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" /> Initial Welcome Intent Buttons (Qualification Menu)
            </CardTitle>
            <CardDescription className="mt-1">
              When a new customer messages on WhatsApp, automatically send interactive buttons to qualify why they reached out (e.g. Booking, General Inquiry, Talk to Team).
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {enabled ? 'Active' : 'Disabled'}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={disabled}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Preset Selector */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs border border-border">
          <span className="font-semibold text-foreground flex items-center gap-1.5 mr-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Load Preset:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleApplyPreset('production')}
            disabled={disabled}
          >
            Production & Rental
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleApplyPreset('services')}
            disabled={disabled}
          >
            Appointment & Booking
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleApplyPreset('support')}
            disabled={disabled}
          >
            Customer Support
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Editor Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="wm-header">Header Text (Optional)</Label>
                <span className="text-[11px] text-muted-foreground">
                  {headerText.length}/60
                </span>
              </div>
              <Input
                id="wm-header"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value.slice(0, 60))}
                placeholder="e.g. Buddies Production / My Business Name"
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="wm-body">Welcome Message / Body Text</Label>
                <span className="text-[11px] text-muted-foreground">
                  {bodyText.length}/1024
                </span>
              </div>
              <Textarea
                id="wm-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value.slice(0, 1024))}
                placeholder="Namaste! 🙏 Welcome. Please confirm what you are reaching out for:"
                rows={4}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="wm-footer">Footer Text (Optional)</Label>
                <span className="text-[11px] text-muted-foreground">
                  {footerText.length}/60
                </span>
              </div>
              <Input
                id="wm-footer"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value.slice(0, 60))}
                placeholder="e.g. Please select an option below"
                disabled={disabled}
              />
            </div>

            {/* Buttons Editor */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Interactive Buttons ({buttons.length}/3 max)
                </Label>
                {buttons.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddButton}
                    disabled={disabled}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Button
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {buttons.map((btn, idx) => (
                  <div
                    key={btn.id || idx}
                    className="rounded-lg border border-border bg-card p-3 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        Button #{idx + 1}
                      </span>
                      {buttons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveButton(idx)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded"
                          disabled={disabled}
                          title="Remove button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Button Title (WhatsApp label)</Label>
                          <span className="text-[10px] text-muted-foreground">
                            {btn.title.length}/20
                          </span>
                        </div>
                        <Input
                          value={btn.title}
                          onChange={(e) =>
                            handleUpdateButton(idx, 'title', e.target.value.slice(0, 20))
                          }
                          placeholder="e.g. Rental Booking"
                          disabled={disabled}
                          className="h-8 text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Click Action</Label>
                        <Select
                          value={btn.action}
                          onValueChange={(val) => {
                            if (val) handleUpdateButton(idx, 'action', val);
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="booking">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                Automated Booking Flow
                              </span>
                            </SelectItem>
                            <SelectItem value="ai_inquiry">
                              <span className="flex items-center gap-1.5">
                                <Bot className="h-3.5 w-3.5 text-emerald-500" />
                                AI Assistant / General Inquiry
                              </span>
                            </SelectItem>
                            <SelectItem value="talk_to_team">
                              <span className="flex items-center gap-1.5">
                                <Headphones className="h-3.5 w-3.5 text-amber-500" />
                                Talk to Team (Human Handover)
                              </span>
                            </SelectItem>
                            <SelectItem value="custom_reply">
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-purple-500" />
                                Instant Custom Message
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {btn.action === 'talk_to_team' && (
                      <div className="space-y-1.5 pt-1 rounded-md bg-muted/40 p-2.5 border border-border/60">
                        <Label className="text-xs flex items-center gap-1.5 text-foreground font-medium">
                          <UserCheck className="h-3.5 w-3.5 text-amber-500" />
                          Assign to Team Member
                        </Label>
                        <Select
                          value={btn.assigned_agent_id || 'unassigned'}
                          onValueChange={(val) => {
                            const agentId = !val || val === 'unassigned' ? '' : val;
                            handleUpdateButton(idx, 'assigned_agent_id', agentId);
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Unassigned (Entire team can handle)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              <span className="text-muted-foreground font-normal">
                                Unassigned (Entire team can handle)
                              </span>
                            </SelectItem>
                            {members.map((m) => (
                              <SelectItem key={m.user_id} value={m.user_id}>
                                <span className="font-medium text-foreground">
                                  {m.full_name || 'Member'}
                                </span>{' '}
                                <span className="text-muted-foreground text-[11px]">
                                  ({m.role}){m.email ? ` • ${m.email}` : ''}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          When customer clicks this button, the chat will automatically be routed & assigned to this team member.
                        </p>
                      </div>
                    )}

                    {btn.action !== 'booking' && (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          {btn.action === 'ai_inquiry' && 'Initial Prompt message to customer:'}
                          {btn.action === 'talk_to_team' && 'Team handover confirmation message:'}
                          {btn.action === 'custom_reply' && 'Predefined reply message to send:'}
                        </Label>
                        <Input
                          value={btn.reply_text || ''}
                          onChange={(e) =>
                            handleUpdateButton(idx, 'reply_text', e.target.value)
                          }
                          placeholder={
                            btn.action === 'ai_inquiry'
                              ? 'Please let us know your query, how can we help you today?'
                              : btn.action === 'talk_to_team'
                              ? 'Our team member will connect with you shortly.'
                              : 'Type message...'
                          }
                          disabled={disabled}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* WhatsApp Message Live Preview Mockup */}
          <div className="rounded-xl border border-border bg-[#0b141a]/95 p-4 flex flex-col justify-between shadow-inner">
            <div>
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/40 text-xs text-[#aebac1]">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>WhatsApp Live Preview</span>
              </div>

              {/* Chat Bubble */}
              <div className="rounded-lg bg-[#202c33] text-[#e9edef] p-3 shadow-md space-y-2.5 max-w-[280px]">
                {headerText.trim() && (
                  <p className="text-xs font-bold text-emerald-400">
                    {headerText}
                  </p>
                )}
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {bodyText.trim() || 'Namaste! Welcome. Please confirm your query:'}
                </p>
                {footerText.trim() && (
                  <p className="text-[10px] text-[#8696a0] pt-1">
                    {footerText}
                  </p>
                )}

                {/* WhatsApp Interactive Buttons */}
                <div className="space-y-1.5 pt-2 border-t border-[#374248]">
                  {buttons.length === 0 ? (
                    <div className="text-[11px] text-center text-[#8696a0] py-2">
                      (No buttons added yet)
                    </div>
                  ) : (
                    buttons.map((btn, i) => {
                      const assignedMember = btn.assigned_agent_id
                        ? members.find((m) => m.user_id === btn.assigned_agent_id)
                        : null;
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="w-full text-center py-1.5 px-3 rounded bg-[#2a3942] hover:bg-[#32444f] text-[#00a884] text-xs font-semibold shadow-sm border border-[#374248]/60 cursor-pointer">
                            {btn.title || `Button ${i + 1}`}
                          </div>
                          {assignedMember && (
                            <div className="text-[10px] text-center text-[#8696a0]">
                              ↳ Routes to {assignedMember.full_name || 'Agent'}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-[#8696a0]">
              💡 Sent automatically on greeting or 1st inbound message.
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            onClick={handleSave}
            disabled={disabled}
            className="px-5 font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Save Welcome Menu
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
