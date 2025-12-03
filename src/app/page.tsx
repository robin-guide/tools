'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status: 'available' | 'coming-soon';
  gradient: string;
}

const tools: Tool[] = [
  {
    id: 'upscaler',
    name: 'Upscaler',
    description: 'AI-powered image upscaling with real-time preview. Runs locally on your GPU.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    ),
    href: '/upscaler',
    status: 'available',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'background-remover',
    name: 'Background Remover',
    description: 'Remove backgrounds from images instantly with AI precision.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    href: '#',
    status: 'coming-soon',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'colorizer',
    name: 'Colorizer',
    description: 'Bring black & white photos to life with AI colorization.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    href: '#',
    status: 'coming-soon',
    gradient: 'from-amber-500 to-orange-500',
  },
];

export default function ToolsPage() {
  return (
    <main className="min-h-screen grain-overlay">
      <div className="fixed inset-0 bg-gradient-to-b from-stone-950 via-stone-950 to-stone-900 -z-10" />
      
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-800/50 border border-stone-700/50 mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-stone-400">Open Source · Local First</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-display font-medium text-stone-100 tracking-tight mb-4">
            Robin Tools
          </h1>
          <p className="text-lg text-stone-500 max-w-xl mx-auto">
            AI-powered creative tools that run locally on your machine. 
            No cloud uploads, no subscriptions.
          </p>
        </motion.div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              {tool.status === 'available' ? (
                <Link href={tool.href} className="block group">
                  <div className="h-full p-6 rounded-2xl bg-stone-900/50 border border-stone-800/50 hover:border-stone-700/50 hover:bg-stone-900/80 transition-all">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform`}>
                      {tool.icon}
                    </div>
                    
                    <h2 className="text-xl font-display font-medium text-stone-100 mb-2 group-hover:text-white transition-colors">
                      {tool.name}
                    </h2>
                    
                    <p className="text-sm text-stone-500 mb-4">
                      {tool.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-sm text-stone-400 group-hover:text-stone-300 transition-colors">
                      <span>Open tool</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="h-full p-6 rounded-2xl bg-stone-900/30 border border-stone-800/30">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tool.gradient} opacity-40 flex items-center justify-center text-white/60 mb-4`}>
                    {tool.icon}
                  </div>
                  
                  <h2 className="text-xl font-display font-medium text-stone-500 mb-2">
                    {tool.name}
                  </h2>
                  
                  <p className="text-sm text-stone-600 mb-4">
                    {tool.description}
                  </p>
                  
                  <span className="inline-flex items-center gap-2 text-xs text-stone-600 px-3 py-1 rounded-full bg-stone-800/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-600" />
                    Coming soon
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-20 text-center"
        >
          <div className="flex items-center justify-center gap-6 text-sm text-stone-600">
            <a 
              href="https://github.com/robin-guide/tools"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-400 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              GitHub
            </a>
            <span className="text-stone-700">·</span>
            <a 
              href="https://robin.guide"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-400 transition-colors"
            >
              Built by Robin
            </a>
          </div>
        </motion.footer>
      </div>
    </main>
  );
}
