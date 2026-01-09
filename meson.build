project('my-gtk4-app', ['c', 'cpp'],
  version: '1.0.0',
  default_options: [
    'cpp_std=c++17',
    'warning_level=1',
  ]
)

# Import gnome module for glib-compile-resources
gnome = import('gnome')

# Dependencies
gtk4_dep = dependency('gtk4')
adwaita_dep = dependency('libadwaita-1')
gstreamer_dep = dependency('gstreamer-1.0', required: false)

deps = [gtk4_dep, adwaita_dep]

# Add GStreamer if available
if gstreamer_dep.found()
  deps += gstreamer_dep
endif

# Compile resources (layout.ui etc.)
resources = gnome.compile_resources(
  'resources',
  'resources.gresource.xml',
  source_dir: meson.current_source_dir(),
)

# Source files
sources = files('main.cpp') + resources

# Platform-specific configuration
host_system = host_machine.system()

cpp_args = []
link_args = []

if host_system == 'windows'
  # Windows-specific libraries
  cpp_args += ['-DNOMINMAX']
  link_args += ['-liphlpapi']
elif host_system == 'linux' or host_system == 'android'
  # Linux/Android doesn't need the Windows-specific code
  # The code should be wrapped in #ifdef _WIN32 which will exclude it
endif

# Build executable
# For Android, the forked meson requires 'android_exe_type: application'
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
