"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Receipt,
  Lightbulb,
  SlidersHorizontal,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Smart Dashboard",
    desc: "Real-time overview of your spending, income, and financial health at a glance.",
  },
  {
    icon: TrendingUp,
    title: "AI Forecasting",
    desc: "Predict future expenses and savings with machine-learning powered projections.",
  },
  {
    icon: Receipt,
    title: "Receipt Scanner",
    desc: "Snap a photo of any receipt and let AI extract and categorize every item.",
  },
  {
    icon: Lightbulb,
    title: "Financial Advisor",
    desc: "Get personalized tips and a financial health score based on your habits.",
  },
  {
    icon: SlidersHorizontal,
    title: "What-If Simulator",
    desc: "Model spending scenarios before making financial decisions.",
  },
  {
    icon: Shield,
    title: "Anomaly Detection",
    desc: "Automatically flag unusual transactions and potential fraud in real time.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500">
              <Wallet className="h-4 w-4 text-black" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Smart<span className="text-green-400">Spend</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-300 hover:text-white">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold transition hover:bg-green-600"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-32 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-400">
          <Zap className="h-3 w-3" />
          AI-Powered Finance Tracking
        </div>

        <h1 className="text-5xl font-extrabold leading-[1.1] sm:text-6xl lg:text-7xl">
          Take Control of Your <span className="text-green-400">Finances</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
          SmartSpend uses artificial intelligence to categorize transactions,
          predict spending, scan receipts, and give you actionable financial
          advice - all in one beautiful dashboard.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-lg bg-green-500 px-8 py-3 font-semibold transition hover:bg-green-600"
          >
            Start for Free
          </Link>

          <a
            href="#features"
            className="rounded-lg border border-white/10 px-8 py-3 transition hover:border-white/30"
          >
            See Features
          </a>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Everything You Need to{" "}
            <span className="text-green-400">Master Your Money</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            Powerful tools backed by AI to help you understand, predict, and
            optimize your personal finances.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="rounded-xl border border-[#1f2c4d] bg-[#0f1b33] p-6 transition hover:border-green-400/30"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20 text-green-400">
                <feature.icon className="h-5 w-5" />
              </div>

              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl rounded-2xl border border-green-500/20 bg-green-500/10 p-12">
          <h2 className="text-3xl font-bold">Ready to SmartSpend?</h2>
          <p className="mx-auto mt-4 max-w-lg text-gray-400">
            Join thousands of users who have transformed their relationship with
            money. Free to start, no credit card required.
          </p>

          <Link
            href="/signup"
            className="mt-8 inline-block rounded-lg bg-green-500 px-10 py-3 font-semibold transition hover:bg-green-600"
          >
            Create Your Account
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-green-500">
              <Wallet className="h-3 w-3 text-black" />
            </div>
            <span className="text-sm font-semibold">SmartSpend</span>
          </div>

          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} SmartSpend. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
