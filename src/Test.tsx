export default function Test() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-gray-900">Tailwind CSS Test Page</h1>

        {/* Spacing */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Spacing & Layout</h2>
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-blue-500 text-white">px-4 py-2</div>
            <div className="px-6 py-3 bg-green-500 text-white">px-6 py-3</div>
            <div className="px-8 py-4 bg-red-500 text-white">px-8 py-4</div>
          </div>
        </section>

        {/* Colors */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Colors</h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-gray-500 h-20 rounded"></div>
            <div className="bg-red-500 h-20 rounded"></div>
            <div className="bg-blue-500 h-20 rounded"></div>
            <div className="bg-green-500 h-20 rounded"></div>
            <div className="bg-yellow-500 h-20 rounded"></div>
          </div>
        </section>

        {/* Typography */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Typography</h2>
          <p className="text-xs">text-xs: The quick brown fox</p>
          <p className="text-sm">text-sm: The quick brown fox</p>
          <p className="text-base">text-base: The quick brown fox</p>
          <p className="text-lg">text-lg: The quick brown fox</p>
          <p className="text-xl">text-xl: The quick brown fox</p>
          <p className="text-2xl">text-2xl: The quick brown fox</p>
        </section>

        {/* Borders & Rounded */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Borders & Rounded</h2>
          <div className="flex gap-4">
            <div className="border border-gray-300 p-4">border</div>
            <div className="border-2 border-blue-500 p-4">border-2</div>
            <div className="border border-gray-300 rounded p-4">rounded</div>
            <div className="border border-gray-300 rounded-lg p-4">rounded-lg</div>
            <div className="border border-gray-300 rounded-full px-6 py-2">rounded-full</div>
          </div>
        </section>

        {/* Flex & Grid */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Flex & Grid</h2>
          <div className="flex justify-between items-center mb-4 bg-gray-100 p-4 rounded">
            <span>justify-between</span>
            <span>items-center</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-purple-200 p-4 rounded">Grid 1</div>
            <div className="bg-purple-300 p-4 rounded">Grid 2</div>
            <div className="bg-purple-400 p-4 rounded">Grid 3</div>
          </div>
        </section>

        {/* Hover & States */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Hover & States</h2>
          <div className="space-x-4">
            <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition">
              Hover me
            </button>
            <button className="px-4 py-2 bg-green-500 text-white rounded hover:scale-105 transition transform">
              Hover scale
            </button>
            <button className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50" disabled>
              Disabled
            </button>
          </div>
        </section>

        {/* Shadow & Opacity */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Shadow & Opacity</h2>
          <div className="flex gap-4">
            <div className="bg-white shadow-sm p-4 rounded">shadow-sm</div>
            <div className="bg-white shadow-md p-4 rounded">shadow-md</div>
            <div className="bg-white shadow-lg p-4 rounded">shadow-lg</div>
            <div className="bg-blue-500 opacity-50 p-4 rounded text-white">opacity-50</div>
          </div>
        </section>

        {/* Responsive */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Responsive (resize window)</h2>
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded">
            <p className="text-sm md:text-base lg:text-xl">
              Responsive text: small on mobile, base on tablet, xl on desktop
            </p>
          </div>
        </section>

        {/* Streamdown Classes Test */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Streamdown Classes (bg, muted, hover)</h2>

          <div className="space-y-4">
            {/* bg-background */}
            <div className="bg-background border border-gray-300 p-4 rounded">
              <code className="text-sm">bg-background</code> - Should be white background
            </div>

            {/* bg-muted */}
            <div className="bg-muted p-4 rounded">
              <code className="text-sm">bg-muted</code> - Should be light gray/muted background
            </div>

            {/* bg-muted with opacity */}
            <div className="bg-muted/80 p-4 rounded">
              <code className="text-sm">bg-muted/80</code> - Should be muted with 80% opacity
            </div>

            {/* text-muted-foreground */}
            <div className="p-4 bg-white rounded border">
              <p className="text-muted-foreground">
                <code className="text-sm">text-muted-foreground</code> - This text should be muted gray
              </p>
            </div>

            {/* border-border */}
            <div className="border border-border p-4 rounded bg-white">
              <code className="text-sm">border-border</code> - Should have a subtle border
            </div>

            {/* hover:bg-muted */}
            <div className="p-4 bg-white border rounded hover:bg-muted transition cursor-pointer">
              <code className="text-sm">hover:bg-muted</code> - Hover me to see muted background
            </div>

            {/* hover:bg-muted/40 */}
            <div className="p-4 bg-white border rounded hover:bg-muted/40 transition cursor-pointer">
              <code className="text-sm">hover:bg-muted/40</code> - Hover me for 40% opacity muted
            </div>

            {/* bg-foreground & text-background (inverted) */}
            <div className="bg-foreground text-background p-4 rounded">
              <code className="text-sm bg-white/20 px-2 py-1 rounded">bg-foreground text-background</code> - Dark background, light text
            </div>

            {/* bg-primary */}
            <div className="bg-primary text-white p-4 rounded">
              <code className="text-sm bg-white/20 px-2 py-1 rounded">bg-primary</code> - Primary color background
            </div>

            {/* hover:bg-primary */}
            <button className="px-4 py-2 bg-white border border-primary text-primary rounded hover:bg-primary hover:text-white transition">
              <code className="text-sm">hover:bg-primary</code> - Hover me
            </button>
          </div>
        </section>

        {/* Check if undefined classes render */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4 text-red-600">❌ These SHOULD NOT work (undefined)</h2>

          <div className="space-y-4">
            <div className="bg-background p-4 border rounded">
              If <code>bg-background</code> is NOT defined, this will have no background color
            </div>

            <div className="bg-muted p-4 rounded">
              If <code>bg-muted</code> is NOT defined, this will have no background color
            </div>

            <div className="text-muted-foreground p-4 bg-white rounded border">
              If <code>text-muted-foreground</code> is NOT defined, this text will be default black
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
