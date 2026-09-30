import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Badge } from "../shadcn/Badge";
import { Button } from "./atoms/Button";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * APPROVAL CARD (Human-in-the-loop)
 * Supports:
 * 1. Official Beautiful UI multi-step question stack (`questions`:
 *    radio / check choices, odometer step counter `1 of 3`,
 *    custom "Something else…" input, Skip & Continue ⏎ / Send ⏎)
 * 2. Single-tool execution confirmation (`title`, `description`,
 *    `toolName`, `onApprove`, `onReject`).
 * ───────────────────────────────────────────────────────── */

export type ApprovalQuestion = {
  q: string;
  type: "radio" | "check";
  options: string[];
};

const DEFAULT_QUESTIONS: ApprovalQuestion[] = [
  {
    q: "How many flavors should we launch?",
    type: "radio",
    options: ["Three (core line)", "Five (full case)", "Just one hero"],
  },
  {
    q: "Which mix-ins should we stock?",
    type: "check",
    options: ["Chocolate chips", "Waffle bits", "Sprinkles"],
  },
  {
    q: "Which market do we enter first?",
    type: "radio",
    options: ["Food trucks", "Grocery freezers", "Scoop shops"],
  },
];

export type ApprovalLabels = {
  skip: string;
  continue: string;
  send: string;
  customPlaceholder: string;
  sentMessage: string;
};

const DEFAULT_LABELS: ApprovalLabels = {
  skip: "Skip",
  continue: "Continue",
  send: "Send",
  customPlaceholder: "Something else…",
  sentMessage: "Answers sent",
};

export type ApprovalCardProps = {
  questions?: ApprovalQuestion[];
  labels?: Partial<ApprovalLabels>;
  onSubmit?: (answers: Record<number, string[]>) => void;
  /** Optional single-action tool confirmation props */
  title?: string;
  description?: string;
  toolName?: string;
  payloadPreview?: string;
  risk?: "Low" | "Medium" | "High";
  onApprove?: () => void;
  onReject?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ApprovalCard({
  questions = DEFAULT_QUESTIONS,
  labels,
  onSubmit,
  title,
  description,
  toolName,
  payloadPreview,
  risk = "Medium",
  onApprove,
  onReject,
  style,
}: ApprovalCardProps) {
  useTheme();
  const copy = { ...DEFAULT_LABELS, ...labels };
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [customInput, setCustomInput] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [singleDecision, setSingleDecision] = useState<"approved" | "rejected" | null>(null);

  // If `title` is provided explicitly, render single-tool approval mode
  if (title) {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.topRow}>
          <Badge tone={risk === "High" ? "danger" : risk === "Medium" ? "warning" : "accent"}>
            {risk} Risk · Approval Required
          </Badge>
          {toolName ? <Text style={styles.toolMono}>{toolName}</Text> : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
        {payloadPreview ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{payloadPreview}</Text>
          </View>
        ) : null}
        {singleDecision ? (
          <View style={styles.resolvedRow}>
            <Badge tone={singleDecision === "approved" ? "success" : "danger"}>
              {singleDecision === "approved" ? "✓ Approved" : "✕ Rejected"}
            </Badge>
          </View>
        ) : (
          <View style={styles.footerRight}>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setSingleDecision("rejected");
                onReject?.();
              }}
            >
              Deny
            </Button>
            <Button
              variant="accent"
              size="sm"
              onPress={() => {
                setSingleDecision("approved");
                onApprove?.();
              }}
            >
              Approve
            </Button>
          </View>
        )}
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={[styles.card, styles.sentCard, style]}>
        <View style={styles.sentCheck}>
          <Text style={styles.sentCheckIcon}>✓</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{copy.sentMessage}</Text>
          <Text style={styles.desc}>
            {Object.values(answers).flat().join(" · ") || "Default preferences applied"}
          </Text>
        </View>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => {
            setSubmitted(false);
            setStep(0);
          }}
        >
          Edit
        </Button>
      </View>
    );
  }

  const currentQ = questions[step] ?? questions[0];
  const selected = answers[step] ?? [];
  const isLast = step === questions.length - 1;

  const toggleOption = (opt: string) => {
    if (currentQ.type === "radio") {
      setAnswers((prev) => ({ ...prev, [step]: [opt] }));
      if (!isLast) {
        setTimeout(() => setStep((s) => Math.min(questions.length - 1, s + 1)), 180);
      }
    } else {
      setAnswers((prev) => {
        const cur = prev[step] ?? [];
        const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
        return { ...prev, [step]: next };
      });
    }
  };

  const advance = () => {
    if (isLast) {
      setSubmitted(true);
      onSubmit?.(answers);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <Text style={styles.questionText}>{currentQ.q}</Text>
        <View style={styles.pager}>
          <Pressable
            disabled={step === 0}
            onPress={() => setStep((s) => Math.max(0, s - 1))}
            style={styles.stepBtn}
          >
            <Text style={[styles.stepArrow, step === 0 && styles.disabledText]}>‹</Text>
          </Pressable>
          <Text style={styles.stepCounter}>
            {step + 1} of {questions.length}
          </Text>
          <Pressable
            disabled={isLast}
            onPress={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
            style={styles.stepBtn}
          >
            <Text style={[styles.stepArrow, isLast && styles.disabledText]}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.optionsList}>
        {currentQ.options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggleOption(opt)}
              style={[styles.optionRow, isSelected && styles.optionRowSelected]}
            >
              <View
                style={[
                  currentQ.type === "radio" ? styles.radioOuter : styles.checkOuter,
                  isSelected && styles.indicatorSelected,
                ]}
              >
                {isSelected ? (
                  <Text style={styles.indicatorMark}>
                    {currentQ.type === "radio" ? "●" : "✓"}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.customRow}>
          <TextInput
            value={customInput[step] ?? ""}
            onChangeText={(txt) => {
              setCustomInput((prev) => ({ ...prev, [step]: txt }));
              if (txt.trim()) {
                setAnswers((prev) => ({ ...prev, [step]: [txt.trim()] }));
              }
            }}
            placeholder={copy.customPlaceholder}
            placeholderTextColor={theme.ink3}
            style={styles.customInput}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Button variant="ghost" size="sm" onPress={advance}>
          {copy.skip}
        </Button>
        <Button variant="primary" size="sm" onPress={advance}>
          {isLast ? `${copy.send} ⏎` : `${copy.continue} ⏎`}
        </Button>
      </View>
    </View>
  );
}

export default ApprovalCard;

const styles = themedStyleSheet(() => ({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 14,
    gap: 12,
  },
  sentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sentCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  sentCheckIcon: {
    color: theme.greenText,
    fontSize: 13,
    fontWeight: "700",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  questionText: {
    flex: 1,
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.inset,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stepBtn: {
    paddingHorizontal: 4,
  },
  stepArrow: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  disabledText: {
    opacity: 0.3,
  },
  stepCounter: {
    color: theme.muted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  optionsList: {
    gap: 6,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  optionRowSelected: {
    borderColor: theme.text,
    backgroundColor: theme.hover,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOuter: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorSelected: {
    borderColor: theme.text,
    backgroundColor: theme.text,
  },
  indicatorMark: {
    color: theme.ink,
    fontSize: 9,
    fontWeight: "700",
  },
  optionLabel: {
    color: theme.ink2,
    fontSize: 13,
  },
  optionLabelSelected: {
    color: theme.text,
    fontWeight: "600",
  },
  customRow: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    paddingHorizontal: 10,
  },
  customInput: {
    color: theme.text,
    fontSize: 12.5,
    paddingVertical: 6,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  toolMono: {
    color: theme.muted,
    fontSize: 11,
  },
  title: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  desc: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  codeBox: {
    backgroundColor: theme.inset,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  codeText: {
    color: theme.ink2,
    fontSize: 11.5,
  },
  resolvedRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
}));
