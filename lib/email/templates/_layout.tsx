/**
 * Shared layout for every transactional email.
 *
 * React Email components render to inline-styled HTML compatible with the
 * weird CSS quirks every mail client has. Stick to their primitives — don't
 * import Tailwind or app-side styled components, those won't survive the
 * conversion.
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// Inline-ish brand colors so we don't pull anything from globals.css
const BRAND = {
  crimson: "#A31F34",
  crimsonDeep: "#871423",
  gold: "#FFCC00",
  bg: "#0A0A0B",
  fg: "#FFFFFF",
  cardBg: "#171719",
  border: "#2A2A2E",
  mutedFg: "#A1A1AA",
};

export function EmailLayout({
  preview,
  children,
}: {
  /** Snippet shown in inbox previews. Under 100 chars works best. */
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body
          style={{
            backgroundColor: BRAND.bg,
            color: BRAND.fg,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            margin: 0,
            padding: "32px 16px",
          }}
        >
          <Container
            style={{
              maxWidth: "560px",
              margin: "0 auto",
              backgroundColor: BRAND.cardBg,
              borderRadius: "16px",
              border: `1px solid ${BRAND.border}`,
              overflow: "hidden",
            }}
          >
            {/* Brand bar */}
            <Section
              style={{
                background: `linear-gradient(135deg, ${BRAND.crimson} 0%, ${BRAND.crimsonDeep} 100%)`,
                padding: "20px 28px",
              }}
            >
              <Text
                style={{
                  margin: 0,
                  color: BRAND.fg,
                  fontSize: "20px",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                RIEL<span style={{ color: BRAND.gold }}>.GG</span>
              </Text>
            </Section>
            <Section style={{ padding: "28px" }}>{children}</Section>
            <Hr style={{ border: 0, borderTop: `1px solid ${BRAND.border}`, margin: 0 }} />
            <Section style={{ padding: "16px 28px" }}>
              <Text
                style={{
                  margin: 0,
                  color: BRAND.mutedFg,
                  fontSize: "11px",
                  lineHeight: "16px",
                }}
              >
                You received this email because a coach or league admin acted on a school,
                roster, or match you&apos;re tied to on RIEL.GG. Replies go to your league
                office.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: BRAND.crimson,
        color: BRAND.fg,
        textDecoration: "none",
        fontWeight: 700,
        fontSize: "14px",
        padding: "12px 22px",
        borderRadius: "8px",
      }}
    >
      {children}
    </a>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 12px 0",
        fontSize: "22px",
        lineHeight: "28px",
        fontWeight: 700,
        color: BRAND.fg,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </Text>
  );
}

export function Body14({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 16px 0",
        fontSize: "14px",
        lineHeight: "22px",
        color: BRAND.fg,
      }}
    >
      {children}
    </Text>
  );
}

export function Muted12({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "16px 0 0 0",
        fontSize: "12px",
        lineHeight: "18px",
        color: BRAND.mutedFg,
      }}
    >
      {children}
    </Text>
  );
}

export function DetailBlock({ children }: { children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: BRAND.bg,
        border: `1px solid ${BRAND.border}`,
        borderRadius: "10px",
        padding: "14px 16px",
        margin: "16px 0",
      }}
    >
      {children}
    </Section>
  );
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Text
      style={{
        margin: "0 0 6px 0",
        fontSize: "13px",
        lineHeight: "20px",
        color: BRAND.fg,
      }}
    >
      <span style={{ color: BRAND.mutedFg, marginRight: "8px" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </Text>
  );
}
