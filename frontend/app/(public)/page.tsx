"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Receipt,
  Lightbulb,
  SlidersHorizontal,
  ArrowRight,
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
    desc: "Model scenarios like salary changes or new subscriptions before committing.",
  },
  {
    icon: Shield,
    title: "Anomaly Detection",
    desc: "Automatically flag unusual transactions and potential fraud in real time.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white overflow-x-hidden">

      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-black/30 backdrop-blur-xl">
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
              className="bg-green-500 hover:bg-green-600 transition px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="pt-32 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-400">
          <Zap className="h-3 w-3" />
          AI-Powered Finance Tracking
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1]">
          Take Control of Your{" "}
          <span className="text-green-400">Finances</span>
        </h1>

        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          SmartSpend uses artificial intelligence to categorize transactions,
          predict spending, scan receipts, and give you actionable financial
          advice - all in one beautiful dashboard.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-green-500 hover:bg-green-600 transition px-8 py-3 rounded-lg font-semibold"
          >
            Start for Free →
          </Link>

          <a
            href="#features"
            className="border border-white/10 hover:border-white/30 transition px-8 py-3 rounded-lg"
          >
            See Features
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Everything You Need to{" "}
            <span className="text-green-400">Master Your Money</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">
            Powerful tools backed by AI to help you understand, predict, and
            optimize your personal finances.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="bg-[#0f1b33] border border-[#1f2c4d] rounded-xl p-6 hover:border-green-400/30 transition"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20 text-green-400">
                <f.icon className="h-5 w-5" />
              </div>

              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="mx-auto max-w-3xl rounded-2xl border border-green-500/20 bg-green-500/10 p-12">
          <h2 className="text-3xl font-bold">Ready to SmartSpend?</h2>
          <p className="mt-4 text-gray-400 max-w-lg mx-auto">
            Join thousands of users who have transformed their relationship with
            money. Free to start, no credit card required.
          </p>

          <Link
            href="/signup"
            className="inline-block mt-8 bg-green-500 hover:bg-green-600 transition px-10 py-3 rounded-lg font-semibold"
          >
            Create Your Account →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
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
