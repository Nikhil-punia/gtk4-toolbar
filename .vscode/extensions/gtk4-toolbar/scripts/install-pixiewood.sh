#!/bin/bash
# Pixiewood (gtk-android-builder) Installation Script for MSYS2
# This script installs all dependencies and sets up the environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Get the installation directory from argument
INSTALL_DIR="${1:-$(pwd)}"

# Detect environment - force UCRT64 if running from plain MSYS or unknown environment
if [[ -n "$MSYSTEM" ]]; then
    case "$MSYSTEM" in
        UCRT64|CLANG64|MINGW64|MINGW32|CLANGARM64)
            ENV_NAME="$MSYSTEM"
            ;;
        *)
            # MSYS or other - force UCRT64 for MinGW packages
            print_warning "Running from $MSYSTEM environment, forcing UCRT64 for MinGW packages"
            ENV_NAME="UCRT64"
            export MSYSTEM="UCRT64"
            ;;
    esac
else
    ENV_NAME="UCRT64"
    export MSYSTEM="UCRT64"
fi

# Normalize to uppercase for comparison
ENV_NAME_UPPER=$(echo "$ENV_NAME" | tr '[:lower:]' '[:upper:]')
ENV_PATH=$(echo "$ENV_NAME" | tr '[:upper:]' '[:lower:]')

print_status "Installing Pixiewood for MSYS2 $ENV_NAME environment"
print_status "Installation directory: $INSTALL_DIR"

# Determine package prefix based on environment (case-insensitive)
case "$ENV_NAME_UPPER" in
    UCRT64)   PKG_PREFIX="mingw-w64-ucrt-x86_64" ;;
    CLANG64)  PKG_PREFIX="mingw-w64-clang-x86_64" ;;
    MINGW64)  PKG_PREFIX="mingw-w64-x86_64" ;;
    MINGW32)  PKG_PREFIX="mingw-w64-i686" ;;
    CLANGARM64) PKG_PREFIX="mingw-w64-clang-aarch64" ;;
    *)        PKG_PREFIX="mingw-w64-ucrt-x86_64" ;;  # Default to UCRT64
esac

print_status "Using package prefix: $PKG_PREFIX"

#==============================================================================
# Step 1: Install system packages via pacman
#==============================================================================
print_status "Step 1: Installing system packages via pacman..."

SYSTEM_PACKAGES=(
    # Core build tools
    "${PKG_PREFIX}-toolchain"
    "${PKG_PREFIX}-meson"
    "${PKG_PREFIX}-ninja"
    "${PKG_PREFIX}-pkgconf"  # Use pkgconf (not pkg-config) to avoid conflicts
    
    # GTK4 and dependencies
    "${PKG_PREFIX}-gtk4"
    "${PKG_PREFIX}-libadwaita"
    "${PKG_PREFIX}-glib2"
    "${PKG_PREFIX}-gobject-introspection"
    
    # XML and XSLT libraries  
    "${PKG_PREFIX}-libxml2"
    "${PKG_PREFIX}-libxslt"
    
    # AppStream for metadata
    "${PKG_PREFIX}-appstream"
    
    # Perl and core modules
    "${PKG_PREFIX}-perl"
    "${PKG_PREFIX}-openssl"
    
    # Shader and SCSS tools
    "${PKG_PREFIX}-sassc"
    "${PKG_PREFIX}-shaderc"
    
    # Git for cloning
    "git"
)

pacman -S --noconfirm --needed "${SYSTEM_PACKAGES[@]}" 2>&1 || {
    print_error "Failed to install system packages"
    exit 1
}

print_success "System packages installed"

#==============================================================================
# Step 2: Install Perl modules from MSYS2 repos where available
#==============================================================================
print_status "Step 2: Installing Perl modules from repositories..."

# These are available in MSYS2 (not MinGW) and should work
PERL_PACKAGES=(
    "perl-XML-LibXML"
    "perl-JSON"
    "perl-ExtUtils-Depends"
    "perl-ExtUtils-PkgConfig"
)

# Try to install available perl packages (some may not exist)
for pkg in "${PERL_PACKAGES[@]}"; do
    pacman -S --noconfirm --needed "$pkg" 2>/dev/null && \
        print_success "Installed $pkg" || \
        print_warning "$pkg not available in repos, will install via CPAN"
done

#==============================================================================
# Step 3: Set up environment for CPAN builds
#==============================================================================
print_status "Step 3: Setting up environment for Perl module builds..."

# CRITICAL: Set PATH to prioritize UCRT64/MinGW binaries over MSYS binaries
# This ensures we use the correct compilers, pkg-config, and libraries
export PATH="/$ENV_PATH/bin:$PATH"
export PKG_CONFIG_PATH="/$ENV_PATH/lib/pkgconfig:/$ENV_PATH/share/pkgconfig"

# Verify we're using the right pkg-config
print_status "Using pkg-config from: $(which pkg-config)"

# Critical: Set library search paths for the linker
# LIBRARY_PATH is used by GCC's linker (ld) to find libraries
export LIBRARY_PATH="/$ENV_PATH/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="/$ENV_PATH/lib:$LD_LIBRARY_PATH"

# Critical: Set include paths that the C compiler will find glib-object.h
export C_INCLUDE_PATH="/$ENV_PATH/include:/$ENV_PATH/include/glib-2.0:/$ENV_PATH/lib/glib-2.0/include:/$ENV_PATH/include/libxml2"
export CPLUS_INCLUDE_PATH="$C_INCLUDE_PATH"

# Set compiler/linker flags
export LDFLAGS="-L/$ENV_PATH/lib"
export CFLAGS="-I/$ENV_PATH/include -I/$ENV_PATH/include/glib-2.0 -I/$ENV_PATH/lib/glib-2.0/include -I/$ENV_PATH/include/libxml2"
export CPPFLAGS="$CFLAGS"
export PERL_MM_USE_DEFAULT=1

# DO NOT set MAKEFLAGS with -j - parallel builds cause Windows CMD spawning issues
unset MAKEFLAGS

# Special options for ExtUtils::MakeMaker-based builds
# Include all necessary paths for Glib XS module compilation
export PERL_MM_OPT="LIBS='-L/$ENV_PATH/lib -lglib-2.0 -lgobject-2.0 -lgirepository-1.0 -lffi -lintl' INC='-I/$ENV_PATH/include -I/$ENV_PATH/include/glib-2.0 -I/$ENV_PATH/lib/glib-2.0/include -I/$ENV_PATH/include/gobject-introspection-1.0 -I/$ENV_PATH/include/libxml2'"

# Verify pkg-config can find glib-2.0
print_status "Verifying pkg-config setup..."
if pkg-config --exists glib-2.0; then
    print_success "pkg-config found glib-2.0"
    print_status "GLib cflags: $(pkg-config --cflags glib-2.0)"
else
    print_error "pkg-config cannot find glib-2.0! Check PKG_CONFIG_PATH"
fi

print_success "Environment configured"

#==============================================================================
# Step 4: Install remaining Perl modules via CPAN
#==============================================================================
print_status "Step 4: Installing remaining Perl modules via CPAN..."

# Configure CPAN for automatic mode
echo "Configuring CPAN..."
cpan_init() {
    perl -MCPAN -e '
        $CPAN::Config->{build_requires_install_policy} = "yes";
        $CPAN::Config->{prerequisites_policy} = "follow";
        $CPAN::Config->{make_install_make_command} = "make";
        $CPAN::Config->{urllist} = ["http://www.cpan.org/"];
        CPAN::HandleConfig->commit;
    ' 2>/dev/null || true
}
cpan_init

# List of modules to install
# Note: Some pure-Perl modules should install easily, XS modules may need compilation
CPAN_MODULES=(
    "Set::Scalar"     # Pure Perl
    "IPC::Run"        # Pure Perl  
    "JSON"            # Pure Perl (fallback if repo version not available)
)

print_status "Installing pure Perl modules..."
for module in "${CPAN_MODULES[@]}"; do
    print_status "Installing $module..."
    cpan -T "$module" 2>&1 && print_success "Installed $module" || print_warning "Could not install $module"
done

# XS modules require compilation - try to install them
print_status "Installing XS Perl modules (may take a while)..."

# Get flags from pkg-config to pass to module builds
GLIB_CFLAGS=$(pkg-config --cflags glib-2.0 gobject-2.0 2>/dev/null || echo "")
GLIB_LIBS=$(pkg-config --libs glib-2.0 gobject-2.0 2>/dev/null || echo "")
GI_CFLAGS=$(pkg-config --cflags gobject-introspection-1.0 2>/dev/null || echo "")
GI_LIBS=$(pkg-config --libs gobject-introspection-1.0 2>/dev/null || echo "")
XML2_CFLAGS=$(pkg-config --cflags libxml-2.0 2>/dev/null || echo "")
XML2_LIBS=$(pkg-config --libs libxml-2.0 2>/dev/null || echo "")
XSLT_CFLAGS=$(pkg-config --cflags libxslt 2>/dev/null || echo "")
XSLT_LIBS=$(pkg-config --libs libxslt libexslt 2>/dev/null || echo "")

print_status "GLIB_CFLAGS: $GLIB_CFLAGS"
print_status "GLIB_LIBS: $GLIB_LIBS"

# Function to install XS module by downloading and building manually with proper flags
install_xs_module() {
    local module="$1"
    local extra_cflags="$2"
    local extra_libs="$3"
    
    if perl -M"$module" -e 1 2>/dev/null; then
        print_success "$module is already installed"
        return 0
    fi
    
    print_status "Installing $module with manual build..."
    
    # Get distribution name
    local dist_name=""
    case "$module" in
        "ExtUtils::Depends") dist_name="ExtUtils-Depends" ;;
        "ExtUtils::PkgConfig") dist_name="ExtUtils-PkgConfig" ;;
        "Glib") dist_name="Glib" ;;
        "Glib::Object::Introspection") dist_name="Glib-Object-Introspection" ;;
        "XML::LibXML") dist_name="XML-LibXML" ;;
        "XML::LibXSLT") dist_name="XML-LibXSLT" ;;
        *) dist_name=$(echo "$module" | tr ':' '-') ;;
    esac
    
    # First, make sure CPAN has downloaded the module
    print_status "Ensuring $module is downloaded via CPAN..."
    perl -MCPAN -e "CPAN::Shell->get('$module')" 2>&1 || true
    
    # Find the CPAN build directory
    local cpan_build_dir="$HOME/.cpan-w64/build"
    if [ ! -d "$cpan_build_dir" ]; then
        cpan_build_dir=$(perl -MCPAN -e 'print $CPAN::Config->{build_dir}' 2>/dev/null)
    fi
    
    # Find the latest version of the distribution directory
    local src_dir=$(ls -td "$cpan_build_dir/${dist_name}-"* 2>/dev/null | head -1)
    
    if [ -z "$src_dir" ] || [ ! -d "$src_dir" ]; then
        print_error "Could not find source directory for $module in $cpan_build_dir"
        return 1
    fi
    
    print_status "Building in $src_dir..."
    cd "$src_dir"
    
    # Clean any previous build attempts
    if [ -f "Makefile" ]; then
        mingw32-make clean 2>/dev/null || make clean 2>/dev/null || true
        rm -f Makefile 2>/dev/null || true
    fi
    
    # Special handling for XML::LibXSLT - patch Makefile.PL for MinGW compatibility
    # The module's have_library() looks for "libxslt.lib" on Win32, but MinGW uses "libxslt.a"
    # The try_link test fails on MSYS2/MinGW, so we skip it for known-good libraries
    if [ "$module" = "XML::LibXSLT" ] && [ -f "Makefile.PL" ]; then
        print_status "Patching Makefile.PL for MinGW compatibility..."
        
        # Replace have_library calls with hardcoded success for xslt and exslt
        # Since we know the libraries are installed via pacman
        perl -i.bak -pe '
            # Skip the library existence checks by returning true directly
            s/if \(!have_library\(\$::is_Win32 \? "libxslt" : "xslt"\)\)/if (0)/;
            s/if \(have_library\(\$::is_Win32 \? "libexslt" : "exslt"\)\)/if (1)/;
            # Fix the LIBS additions for MinGW (remove the "lib" prefix)
            s/-llibxslt\.lib/-lxslt/g;
            s/-llibxslt\b/-lxslt/g;
            s/-llibexslt\.lib/-lexslt/g;
            s/-llibexslt\b/-lexslt/g;
            s/-llibxml2\.lib/-lxml2/g;
            s/-llibxml2\b/-lxml2/g;
            s/-lzlib\b/-lz/g;
            # Fix exslt_defaults for MinGW
            s/\$exslt_defaults = \$::is_Win32 \?.*q\/-lexslt\//\$exslt_defaults = q\/-lexslt\//;
        ' Makefile.PL
        print_status "Makefile.PL patched for MinGW"
    fi
    
    # Set up environment for this specific build
    # Use Windows-style paths for library linking
    local win_lib_path=$(cygpath -w "/$ENV_PATH/lib" 2>/dev/null || echo "/$ENV_PATH/lib")
    
    export LDFLAGS="-L/$ENV_PATH/lib"
    export CFLAGS="-I/$ENV_PATH/include $extra_cflags"
    export LIBS="$extra_libs"
    
    # Run Makefile.PL with explicit INC and LIBS
    # Pass LIBS explicitly so it goes into the Makefile correctly
    print_status "Running: perl Makefile.PL"
    print_status "  INC=$extra_cflags"
    print_status "  LIBS=$extra_libs"
    
    if ! perl Makefile.PL INC="$extra_cflags" LIBS="$extra_libs" 2>&1; then
        print_error "Makefile.PL failed for $module"
        cd - > /dev/null
        return 1
    fi
    
    # DON'T modify the Makefile with sed - it corrupts paths on Windows
    # The LIBS passed to Makefile.PL should be enough
    
    if [ -f "Makefile" ]; then
        print_status "Makefile generated, checking LIBS..."
        grep "^EXTRALIBS" Makefile | head -1 || true
        grep "^LDLOADLIBS" Makefile | head -1 || true
        grep "^LDDLFLAGS" Makefile | head -1 || true
        
        # Use Perl to safely patch the Makefile - add library flags if missing
        # This is safer than sed on Windows/MSYS2
        if [ -n "$extra_libs" ]; then
            print_status "Patching Makefile to ensure library flags are included..."
            perl -i.bak -pe '
                BEGIN { $libs = "'"$extra_libs"'"; $lpath = "-L/'"$ENV_PATH"'/lib"; }
                if (/^LDLOADLIBS\s*=\s*(.*)/) {
                    unless ($1 =~ /-lgobject-2.0/) {
                        s/^(LDLOADLIBS\s*=\s*)(.*)/$1$lpath $libs $2/;
                    }
                }
                if (/^EXTRALIBS\s*=\s*(.*)/) {
                    unless ($1 =~ /-lgobject-2.0/) {
                        s/^(EXTRALIBS\s*=\s*)(.*)/$1$lpath $libs $2/;
                    }
                }
                if (/^LDDLFLAGS\s*=/) {
                    unless (/$lpath/) {
                        s/^(LDDLFLAGS\s*=\s*)(.*)/$1$lpath $2/;
                    }
                }
            ' Makefile
            
            print_status "After patching:"
            grep "^EXTRALIBS" Makefile | head -1 || true
            grep "^LDLOADLIBS" Makefile | head -1 || true
            grep "^LDDLFLAGS" Makefile | head -1 || true
        fi
    fi
    
    # Ensure library path is in LIBRARY_PATH for the linker
    export LIBRARY_PATH="/$ENV_PATH/lib:$LIBRARY_PATH"
    
    # Build using mingw32-make with single thread to avoid CMD spawning issues
    # The -j parallel build causes Windows CMD to spawn which breaks things
    print_status "Running mingw32-make (single-threaded to avoid Windows CMD issues)..."
    
    # Pass OTHERLDFLAGS to add our library path to the linker
    if ! mingw32-make OTHERLDFLAGS="-L/$ENV_PATH/lib" 2>&1; then
        print_warning "mingw32-make failed, trying make..."
        if ! make OTHERLDFLAGS="-L/$ENV_PATH/lib" 2>&1; then
            print_error "make failed for $module"
            cd - > /dev/null
            return 1
        fi
    fi
    
    # Install
    print_status "Running mingw32-make install..."
    if ! mingw32-make install 2>&1; then
        print_warning "mingw32-make install failed, trying make install..."
        if ! make install 2>&1; then
            print_error "make install failed for $module"
            cd - > /dev/null
            return 1
        fi
    fi
    
    cd - > /dev/null
    
    # Verify installation
    if perl -M"$module" -e 1 2>/dev/null; then
        print_success "Successfully installed $module"
        return 0
    else
        print_error "Installation verification failed for $module"
        return 1
    fi
}

# Install ExtUtils modules first (dependencies)
install_xs_module "ExtUtils::Depends" "" ""
install_xs_module "ExtUtils::PkgConfig" "" ""

# Install Glib (required by Glib::Object::Introspection)
# Include -L path explicitly with the libraries
install_xs_module "Glib" "$GLIB_CFLAGS" "-L/$ENV_PATH/lib $GLIB_LIBS"

# Get the path where Glib headers were installed (needed for Glib::Object::Introspection)
GLIB_PERL_INC=$(perl -MGlib -e 'print $INC{"Glib.pm"} =~ s/Glib\.pm//r' 2>/dev/null)
GLIB_PERL_ARCH=$(perl -MConfig -e 'print $Config{archlib}')
GLIB_PERL_HEADERS="-I$GLIB_PERL_ARCH/auto/Glib -I$GLIB_PERL_ARCH/Glib/Install"

# Search for gperl.h in common locations
# Get Perl version for site_perl paths
PERL_VERSION=$(perl -MConfig -e 'print $Config{version}')
print_status "Perl version: $PERL_VERSION"

GPERL_INC=""
GPERL_SEARCH_PATHS=(
    # Installed locations (most likely after successful Glib install)
    "/$ENV_PATH/lib/perl5/site_perl/$PERL_VERSION/Glib/Install"
    "/$ENV_PATH/lib/perl5/site_perl/Glib/Install"
    "/$ENV_PATH/lib/perl5/vendor_perl/$PERL_VERSION/Glib/Install"
    "/$ENV_PATH/lib/perl5/vendor_perl/Glib/Install"
    # Arch-specific locations
    "$GLIB_PERL_ARCH/auto/Glib"
    "$GLIB_PERL_ARCH/Glib/Install"
    "/$ENV_PATH/lib/perl5/vendor_perl/auto/Glib"
    "/$ENV_PATH/lib/perl5/site_perl/auto/Glib"
    "/$ENV_PATH/lib/perl5/core_perl/auto/Glib"
    "/usr/lib/perl5/vendor_perl/auto/Glib"
    "/usr/lib/perl5/site_perl/auto/Glib"
    # CPAN build directory (fallback)
    "$HOME/.cpan-w64/build/Glib-"*/
)

for search_path in "${GPERL_SEARCH_PATHS[@]}"; do
    # Handle glob patterns
    for dir in $search_path; do
        if [ -f "$dir/gperl.h" ]; then
            GPERL_INC="-I$dir"
            print_success "Found gperl.h at $dir"
            break 2
        fi
    done
done

# If not found in standard locations, try to find it anywhere under Perl lib paths
if [ -z "$GPERL_INC" ]; then
    print_status "Searching for gperl.h in Perl library directories..."
    GPERL_PATH=$(find "/$ENV_PATH/lib/perl5" -name "gperl.h" 2>/dev/null | head -1)
    if [ -n "$GPERL_PATH" ]; then
        GPERL_DIR=$(dirname "$GPERL_PATH")
        GPERL_INC="-I$GPERL_DIR"
        print_success "Found gperl.h at $GPERL_DIR"
    fi
fi

# If still not found, search CPAN build directories as fallback
if [ -z "$GPERL_INC" ]; then
    print_status "Searching for gperl.h in CPAN build directories..."
    GPERL_PATH=$(find "$HOME/.cpan-w64/build" -name "gperl.h" 2>/dev/null | head -1)
    if [ -n "$GPERL_PATH" ]; then
        GPERL_DIR=$(dirname "$GPERL_PATH")
        GPERL_INC="-I$GPERL_DIR"
        print_success "Found gperl.h at $GPERL_DIR"
    fi
fi

# If still not found, check if Glib was installed and get its typemap location
if [ -z "$GPERL_INC" ]; then
    print_status "Trying to get Glib include path via ExtUtils::Depends..."
    GPERL_INC=$(perl -MExtUtils::Depends -e '
        my $d = ExtUtils::Depends->new("Glib::Object::Introspection", "Glib");
        my %args = $d->get_makefile_vars();
        print $args{INC} if $args{INC};
    ' 2>/dev/null || echo "")
fi

# Convert MSYS paths to Windows-style paths for GCC compatibility
# GCC in MSYS2 often works better with Windows-style paths for -I flags
if [ -n "$GPERL_INC" ]; then
    # Extract the path from -I flag
    GPERL_PATH_ONLY=$(echo "$GPERL_INC" | sed 's/^-I//')
    # Convert to Windows path if it starts with /
    if [[ "$GPERL_PATH_ONLY" == /* ]]; then
        WIN_GPERL_PATH=$(cygpath -m "$GPERL_PATH_ONLY" 2>/dev/null || echo "$GPERL_PATH_ONLY")
        GPERL_INC="-I$WIN_GPERL_PATH"
    fi
fi

print_status "GPERL_INC (final): $GPERL_INC"

# Also check the Glib Install/Files.pm for the proper include path
GLIB_INSTALL_INC=$(perl -MGlib::Install::Files -e '
    my $f = Glib::Install::Files->Inline("C");
    if (ref($f) eq "HASH" && $f->{INC}) {
        print $f->{INC};
    }
' 2>/dev/null || echo "")
print_status "Glib Install INC: $GLIB_INSTALL_INC"

# Combine all include paths for dependent modules
GLIB_DEP_CFLAGS="$GLIB_CFLAGS $GPERL_INC $GLIB_INSTALL_INC"
print_status "Combined INC for Glib dependents: $GLIB_DEP_CFLAGS"

# Install Glib::Object::Introspection
# Needs: libffi (for ffi_* functions), libgmodule-2.0 (for g_module_* functions)
GI_FULL_LIBS="-L/$ENV_PATH/lib $GLIB_LIBS $GI_LIBS -lgmodule-2.0 -lffi"
print_status "Glib::Object::Introspection LIBS: $GI_FULL_LIBS"
install_xs_module "Glib::Object::Introspection" "$GLIB_DEP_CFLAGS $GI_CFLAGS" "$GI_FULL_LIBS"

# Install XML modules
install_xs_module "XML::LibXML" "$XML2_CFLAGS" "-L/$ENV_PATH/lib $XML2_LIBS"
install_xs_module "XML::LibXSLT" "$XSLT_CFLAGS" "-L/$ENV_PATH/lib $XSLT_LIBS"

#==============================================================================
# Step 5: Check for Java 17+ (required for Svg2Avd)
#==============================================================================
print_status "Step 5: Checking for Java 17+..."

check_java() {
    if command -v java &> /dev/null; then
        JAVA_VER=$(java -version 2>&1 | head -1 | sed 's/.*version "\([0-9]*\).*/\1/')
        if [[ "$JAVA_VER" -ge 17 ]]; then
            print_success "Java $JAVA_VER found"
            return 0
        else
            print_warning "Java $JAVA_VER found, but version 17+ is recommended"
            return 1
        fi
    else
        print_warning "Java not found - Svg2Avd will not work without Java 17+"
        return 1
    fi
}

if ! check_java; then
    print_warning "Please install Java 17+ for full functionality"
    print_warning "You can install it from: https://adoptium.net/ or via pacman:"
    print_warning "  pacman -S mingw-w64-x86_64-openjdk17"
fi

#==============================================================================
# Step 6: Clone/update gtk-android-builder
#==============================================================================
print_status "Step 6: Setting up gtk-android-builder..."

cd "$INSTALL_DIR"

if [ -d "gtk-android-builder" ]; then
    print_status "Updating existing gtk-android-builder..."
    cd gtk-android-builder
    git pull
else
    print_status "Cloning gtk-android-builder..."
    git clone https://github.com/sp1ritCS/gtk-android-builder.git
    cd gtk-android-builder
fi

# Make pixiewood executable
chmod +x pixiewood 2>/dev/null || true

PIXIEWOOD_PATH="$INSTALL_DIR/gtk-android-builder/pixiewood"

print_success "gtk-android-builder installed at: $PIXIEWOOD_PATH"

#==============================================================================
# Step 7: Clone forked meson (required for android_exe_type support)
#==============================================================================
print_status "Step 7: Setting up forked meson (sp1ritCS fork)..."

cd "$INSTALL_DIR"

if [ -d "meson-fork" ]; then
    print_status "Updating existing meson fork..."
    cd meson-fork
    git pull
else
    print_status "Cloning sp1ritCS meson fork..."
    git clone https://github.com/nicubarbaros/meson.git meson-fork || \
    git clone https://github.com/sp1ritCS/meson.git meson-fork
    cd meson-fork
fi

MESON_FORK_PATH="$INSTALL_DIR/meson-fork"
print_success "Forked meson at: $MESON_FORK_PATH"

#==============================================================================
# Step 8: Verify installation
#==============================================================================
print_status "Step 8: Verifying installation..."

echo ""
echo "========================================"
echo "        Installation Summary"
echo "========================================"
echo ""

# Check Perl modules
check_perl_module() {
    if perl -M"$1" -e 1 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "  ${RED}✗${NC} $1"
        return 1
    fi
}

echo "Perl modules status:"
MODULES_OK=true
for module in Glib Glib::Object::Introspection IPC::Run JSON Set::Scalar XML::LibXML XML::LibXSLT; do
    check_perl_module "$module" || MODULES_OK=false
done

echo ""
echo "Paths:"
echo "  Pixiewood: $PIXIEWOOD_PATH"
echo "  Forked Meson: $MESON_FORK_PATH"
echo ""

if [ "$MODULES_OK" = true ]; then
    print_success "Installation complete! All Perl modules are available."
else
    print_warning "Some Perl modules are missing. The installation may not work fully."
    print_warning "Try running: cpan -T <module_name> for missing modules"
fi

echo ""
echo "========================================"
echo "        Next Steps"
echo "========================================"
echo ""
echo "1. Configure pixiewood path in VS Code GTK4 Toolbar settings"
echo "2. Create a pixiewood.xml manifest in your project"
echo "3. Set up Android SDK and NDK paths"
echo ""
print_status "Script completed!"
