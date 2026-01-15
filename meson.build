project('my-gtk4-app', ['c', 'cpp'],
  version: '1.0.0',
  default_options: [
    'cpp_std=c++17',
    'warning_level=1',
  ]
)

# Import gnome module
gnome = import('gnome')

# --- Dependencies ---

# 1. Core GTK/Adwaita
gtk4_dep = dependency('gtk4')
adwaita_dep = dependency('libadwaita-1')

# 2. Networking (Libsoup + Glib-Networking for HTTPS)
# We use 'fallback' to ensure Meson uses the subprojects/ folders if the SDK is missing them.
libsoup_dep = dependency('libsoup-3.0', fallback: ['libsoup', 'libsoup_dep'])

# glib-networking is a GIO module. We add it here to ensure it gets compiled 
# and installed into the APK. Without this, HTTPS will fail.
glib_net_dep = dependency('glib-networking-2.0', 
  fallback: ['glib-networking', 'glib_networking_dep'],
  required: true
)

# 3. Multimedia (Optional)
gstreamer_dep = dependency('gstreamer-1.0', required: false)

# Combine all dependencies
deps = [gtk4_dep, adwaita_dep, libsoup_dep, glib_net_dep]

if gstreamer_dep.found()
  deps += gstreamer_dep
endif

# --- Resources & Sources ---

resources = gnome.compile_resources(
  'resources',
  'resources.gresource.xml',
  source_dir: meson.current_source_dir(),
)

sources = files('main.cpp') + resources

# --- Platform Specifics ---

host_system = host_machine.system()
cpp_args = []
link_args = []

if host_system == 'windows'
  cpp_args += ['-DNOMINMAX']
  link_args += ['-liphlpapi']
endif

# --- Build Target ---

if host_system == 'android'
  executable('hello',
    sources,
    dependencies: deps,
    cpp_args: cpp_args,
    link_args: link_args,
    install: true,
    android_exe_type: 'application'
  )
else
  executable('hello',
    sources,
    dependencies: deps,
    cpp_args: cpp_args,
    link_args: link_args,
    install: true
  )
endif