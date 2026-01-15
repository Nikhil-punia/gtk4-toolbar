/**
 * Pixiewood Patcher
 * Handles patching the pixiewood script for Windows/MSYS2 compatibility
 * Complete implementation matching original extension.js
 */
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { Logger } = require('../utils');

class PixiewoodPatcher {
    /**
     * Apply all Windows compatibility patches to pixiewood script
     * @param {string} pixiewoodScriptPath - Path to the pixiewood script
     * @returns {boolean} - Whether any patches were applied
     */
    patchForWindows(pixiewoodScriptPath) {
        if (!pixiewoodScriptPath || !fs.existsSync(pixiewoodScriptPath)) {
            return false;
        }

        try {
            let scriptContent = fs.readFileSync(pixiewoodScriptPath, 'utf8');
            let patched = false;

            // Patch 0: Add getcwd to Cwd imports (required for Windows)
            if (scriptContent.includes('use Cwd qw(abs_path);') &&
                !scriptContent.includes('use Cwd qw(abs_path getcwd);')) {
                scriptContent = scriptContent.replace(
                    'use Cwd qw(abs_path);',
                    'use Cwd qw(abs_path getcwd);'
                );
                patched = true;
            }

            // Patch 1: Add dirname to File::Basename imports
            if (scriptContent.includes('use File::Basename qw(fileparse);') &&
                !scriptContent.includes('use File::Basename qw(fileparse dirname);')) {
                scriptContent = scriptContent.replace(
                    'use File::Basename qw(fileparse);',
                    'use File::Basename qw(fileparse dirname);'
                );
                patched = true;
            }

            // Patch 2: Add rmtree to File::Path imports
            if (scriptContent.includes('use File::Path qw(make_path);') &&
                !scriptContent.includes('use File::Path qw(make_path rmtree);')) {
                scriptContent = scriptContent.replace(
                    'use File::Path qw(make_path);',
                    'use File::Path qw(make_path rmtree);'
                );
                patched = true;
            }

            // Patch 3: Host tag detection for Windows NDK paths
            if (scriptContent.includes("'$toolchain/toolchains/llvm/prebuilt/linux-x86_64/'") &&
                !scriptContent.includes('windows-x86_64')) {
                const oldLine = "$tcc->set_string(\"constants\", \"toolchain\", \"'$toolchain/toolchains/llvm/prebuilt/linux-x86_64/'\");";
                const newLine = `# Detect host OS for NDK toolchain path (auto-patched for Windows)
		my $host_tag = $^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin' ? 'windows-x86_64' : 'linux-x86_64';
		my $cmd_ext = $^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin' ? '.cmd' : '';
		$tcc->set_string("constants", "toolchain", "'$toolchain/toolchains/llvm/prebuilt/$host_tag/'");
		$tcc->set_string("constants", "cmd_ext", "'$cmd_ext'");`;
                scriptContent = scriptContent.replace(oldLine, newLine);
                patched = true;
            }

            // Patch 4: Replace force_symlink with copy fallback for Windows
            const oldForceSymlink = `		sub force_symlink {
			my ($target, $new) = @_;

			return 1 if symlink($target, $new);
			if ($!{EEXIST}) {
				unlink($new) or return undef;
				symlink($target, $new) or return undef;
				return 1;
			}
			return undef;
		}`;

            const newForceSymlink = `		sub force_symlink {
			my ($target, $new) = @_;

			# Try symlink first
			return 1 if symlink($target, $new);
			if ($!{EEXIST}) {
				unlink($new) or rmtree($new);
				return 1 if symlink($target, $new);
			}
			
			# Symlink failed - fall back to copy (for Windows)
			print "Symlink failed, falling back to copy: $target -> $new\\n" if $verbose;
			if (-d $target) {
				# Copy directory recursively using Perl
				rmtree($new) if -e $new;
				make_path($new);
				
				# Get absolute paths and normalize
				my $target_abs = rel2abs($target);
				my $new_abs = rel2abs($new);
				my $target_len = length($target_abs);
				
				# Recursive copy using File::Find
				find(sub {
					my $src = $File::Find::name;
					
					# Get the relative portion by comparing absolute paths
					my $src_abs = rel2abs($src);
					return if $src_abs eq $target_abs; # Skip the root directory itself
					
					# Calculate relative path by stripping the target prefix
					my $rel = substr($src_abs, $target_len);
					$rel =~ s/^[\\\\\\\/]+//; # Remove leading slashes
					return unless $rel; # Skip if no relative part
					
					my $dest = catfile($new_abs, split(/[\\\\\\\/]/, $rel));
					
					if (-d $src) {
						make_path($dest);
					} elsif (-f $src) {
						my $dest_dir = dirname($dest);
						make_path($dest_dir) unless -d $dest_dir;
						copy($src, $dest) or warn "Failed to copy $src to $dest: $!";
					}
				}, $target_abs);
				return 1;
			} elsif (-f $target) {
				# Copy file
				unlink($new) if -e $new;
				make_path(dirname($new));
				return copy($target, $new) ? 1 : undef;
			}
			return undef;
		}`;

            if (scriptContent.includes(oldForceSymlink)) {
                scriptContent = scriptContent.replace(oldForceSymlink, newForceSymlink);
                patched = true;
            }

            // Patch 5: cmd_ext for compilers if host_tag exists but cmd_ext missing
            if (scriptContent.includes('windows-x86_64') && !scriptContent.includes('cmd_ext')) {
                const oldHostTag = `$tcc->set_string("constants", "toolchain", "'$toolchain/toolchains/llvm/prebuilt/$host_tag/'");`;
                const newHostTag = `$tcc->set_string("constants", "toolchain", "'$toolchain/toolchains/llvm/prebuilt/$host_tag/'");
		$tcc->set_string("constants", "cmd_ext", "'$cmd_ext'");`;

                if (!scriptContent.includes("my $cmd_ext")) {
                    scriptContent = scriptContent.replace(
                        "my $host_tag = $^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin' ? 'windows-x86_64' : 'linux-x86_64';",
                        "my $host_tag = $^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin' ? 'windows-x86_64' : 'linux-x86_64';\n\t\tmy $cmd_ext = $^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin' ? '.cmd' : '';"
                    );
                }
                scriptContent = scriptContent.replace(oldHostTag, newHostTag);
                patched = true;
            }

            // Patch 6: Fix jniLibs for Windows - create dir instead of symlink since root/lib doesn't exist during generate
            if (scriptContent.includes('force_symlink("../../../../root/lib", catfile($output_dir, "app/src/main/jniLibs"))')) {
                scriptContent = scriptContent.replace(
                    'force_symlink("../../../../root/lib", catfile($output_dir, "app/src/main/jniLibs")) or die "Failed to symlink libraries: $!";',
                    `# For jniLibs - the root/lib directory is created during 'build' step, not 'generate'
		# On Linux, a dangling symlink is OK. On Windows, we create the jniLibs dir now and
		# the build step will copy/link the actual libraries later.
		my $jniLibs_path = catfile($output_dir, "app/src/main/jniLibs");
		my $libs_target = catfile($pixiewood_dirname, "root/lib");
		if (!symlink("../../../../root/lib", $jniLibs_path)) {
			# Symlink failed (Windows) - just create an empty directory for now
			# The build step will need to populate it
			print "Note: Creating jniLibs directory (will be populated during build)\\n" if $verbose;
			make_path($jniLibs_path);
		}`
                );
                patched = true;
            }

            // Also check for our previous abs path fix and update it
            if (scriptContent.includes('rel2abs(catfile($output_dir, "root/lib"))')) {
                scriptContent = scriptContent.replace(
                    /my \$libs_target = rel2abs\(catfile\(\$output_dir, "root\/lib"\)\);\s*\n\s*force_symlink\(\$libs_target, catfile\(\$output_dir, "app\/src\/main\/jniLibs"\)\)[^;]*;/,
                    `# For jniLibs - the root/lib directory is created during 'build' step, not 'generate'
		# On Linux, a dangling symlink is OK. On Windows, we create the jniLibs dir now and
		# the build step will copy/link the actual libraries later.
		my $jniLibs_path = catfile($output_dir, "app/src/main/jniLibs");
		my $libs_target = catfile($pixiewood_dirname, "root/lib");
		if (!symlink("../../../../root/lib", $jniLibs_path)) {
			# Symlink failed (Windows) - just create an empty directory for now
			# The build step will need to populate it
			print "Note: Creating jniLibs directory (will be populated during build)\\n" if $verbose;
			make_path($jniLibs_path);
		}`
                );
                patched = true;
            }

            // Patch 7: Add jniLibs copy step in build for Windows
            if (scriptContent.includes("run \\@cmd or die('Failed to install files');") &&
                !scriptContent.includes('Copying libraries to jniLibs')) {
                scriptContent = scriptContent.replace(
                    /run \\@cmd or die\('Failed to install files'\);\s*\n\s*\}\s*\n\s*our \$asset_install_dir/,
                    `run \\@cmd or die('Failed to install files');
		}

		# On Windows, jniLibs is a real directory (not a symlink), so we need to copy the libs
		my $jniLibs_path = catfile($pixiewood_dirname, "android/app/src/main/jniLibs");
		my $root_lib = catfile($pixiewood_dirname, "root/lib");
		if (-d $jniLibs_path && !-l $jniLibs_path && -d $root_lib) {
			print "Copying libraries to jniLibs (Windows fallback)...\\n" if $verbose;
			rmtree($jniLibs_path);
			make_path($jniLibs_path);
			my $root_lib_abs = rel2abs($root_lib);
			my $jniLibs_abs = rel2abs($jniLibs_path);
			my $root_lib_len = length($root_lib_abs);
			find(sub {
				my $src = $File::Find::name;
				my $src_abs = rel2abs($src);
				return if $src_abs eq $root_lib_abs;
				
				my $rel = substr($src_abs, $root_lib_len);
				$rel =~ s/^[\\\\\\\\\\\\\\\\]+//;
				return unless $rel;
				
				my $dest = catfile($jniLibs_abs, split(/[\\\\\\\\\\\\\\\\]/, $rel));
				
				if (-d $src) {
					make_path($dest);
				} elsif (-f $src) {
					my $dest_dir = dirname($dest);
					make_path($dest_dir) unless -d $dest_dir;
					copy($src, $dest) or warn "Failed to copy $src to $dest: $!";
				}
			}, $root_lib_abs);
		}

		our $asset_install_dir`
                );
                patched = true;
            }

            // Patch 7b: Copy libc++_shared.so from NDK to jniLibs (required for C++ runtime)
            if (scriptContent.includes('Copying libraries to jniLibs') &&
                !scriptContent.includes('libc++_shared.so')) {
                scriptContent = scriptContent.replace(
                    /\}, \$root_lib_abs\);\s*\n\s*\}\s*\n\s*our \$asset_install_dir/,
                    `}, $root_lib_abs);
			
			# Also copy libc++_shared.so from NDK (required C++ runtime library)
			my $ndk_path = $cfg->{'toolchain'};
			$ndk_path =~ s/[\\\\\\\\]+/\\//g;
			# $cfg->{'toolchain'} already includes toolchains/llvm/prebuilt/$host_tag/
			# so we just need to append sysroot/usr/lib/$ndk_arch/
			for my $arch_dir (glob("$jniLibs_abs/*")) {
				next unless -d $arch_dir;
				my $arch_name = (fileparse($arch_dir))[0];
				my $ndk_arch = $arch_name eq 'arm64-v8a' ? 'aarch64-linux-android' :
				               $arch_name eq 'armeabi-v7a' ? 'arm-linux-androideabi' :
				               $arch_name eq 'x86_64' ? 'x86_64-linux-android' :
				               $arch_name eq 'x86' ? 'i686-linux-android' : undef;
				next unless $ndk_arch;
				
				# toolchain path already has prebuilt/$host_tag/ so just add sysroot path
				my $libcpp = "$ndk_path/sysroot/usr/lib/$ndk_arch/libc++_shared.so";
				if (-f $libcpp) {
					copy($libcpp, catfile($arch_dir, "libc++_shared.so")) or warn "Failed to copy libc++_shared.so: $!";
					print "Copied libc++_shared.so to $arch_name\\n" if $verbose;
				}
			}
		}

		our $asset_install_dir`
                );
                patched = true;
            }

            // Patch 8: JAVA_HOME auto-detection for Windows
            if (!scriptContent.includes('Auto-detect JAVA_HOME') && scriptContent.includes('unless ($skip_gradle)')) {
                const javaHomeAutoDetect = `
			# Auto-detect JAVA_HOME if not set (Windows)
			if (!$ENV{JAVA_HOME} && ($^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin')) {
				my @java_paths = (
					'C:/Program Files/Eclipse Adoptium',
					'C:/Program Files/Java',
					'C:/Program Files/Android/Android Studio/jbr',
					'C:/Program Files/Android/Android Studio/jre',
				);
				for my $base (@java_paths) {
					if (-d $base) {
						opendir(my $dh, $base) or next;
						my @jdks = sort { $b cmp $a } grep { -d "$base/$_" && /^jdk-?\\d/ } readdir($dh);
						closedir($dh);
						if (@jdks) {
							$ENV{JAVA_HOME} = "$base/$jdks[0]";
							print "Auto-detected JAVA_HOME: $ENV{JAVA_HOME}\\n" if $verbose;
							last;
						}
					}
				}
			}
			`;

                scriptContent = scriptContent.replace(
                    /unless \(\$skip_gradle\) \{\s*\n\s*\$ENV\{ANDROID_HOME\}/,
                    `unless ($skip_gradle) {${javaHomeAutoDetect}\n\t\t\t$ENV{ANDROID_HOME}`
                );
                patched = true;
            }

            // Patch 9: Gradle bash execution for Windows (run gradlew through bash with proper MSYS2 PATH)
            if (!scriptContent.includes('Running Gradle in:') && scriptContent.includes('exec ("./gradlew"')) {
                const gradleBashExec = `
			# On Windows/MSYS2, we need to run gradlew via bash since it's a shell script
			if ($^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin') {
				print "Running Gradle in: $android_dir\\n" if $verbose;
				
				# Find bash.exe - derive MSYS2 root from Perl path
				my $perl_path = $^X;
				my $msys2_root = $perl_path;
				$msys2_root =~ s/[\\\\\\/]ucrt64[\\\\\\/].*$//i;
				$msys2_root =~ s/[\\\\\\/]mingw64[\\\\\\/].*$//i;
				$msys2_root =~ s/[\\\\\\/]mingw32[\\\\\\/].*$//i;
				$msys2_root =~ s/[\\\\\\/]clang64[\\\\\\/].*$//i;
				my $bash_path = "$msys2_root/usr/bin/bash.exe";
				
				print "Using bash: $bash_path\\n" if $verbose;
				
				my $gradle = fork;
				die "fork failed: $!" unless defined $gradle;

				if ($gradle == 0) {
					# Set up PATH to include MSYS2 bin directories for sh, bash, etc.
					my $msys_bin = "$msys2_root/usr/bin";
					$ENV{PATH} = "$msys_bin;$ENV{PATH}";
					chdir $android_dir or die("Failed to enter android directory: $!");
					# gradlew is a shell script, so we need to run it through bash
					exec ($bash_path, "-c", "./gradlew --no-daemon $build_type") or die "exec failed: $!";
				}

				waitpid($gradle, 0);
				die "Gradle build failed" unless $? == 0;
			} else {
				my $gradle = fork;
				die "fork failed: $!" unless defined $gradle;

				if ($gradle == 0) {
					chdir $android_dir or die("Failed to enter android directory: $!");
					exec ("./gradlew",  "--no-daemon", $build_type) or die "exec failed: $!";
				}

				waitpid($gradle, 0);
				die "Gradle build failed" unless $? == 0;
			}`;

                // Replace the simple gradlew exec with the Windows-aware version
                scriptContent = scriptContent.replace(
                    /my \$gradle = fork;\s*\n\s*die "fork failed: \$!" unless defined \$gradle;\s*\n\s*if \(\$gradle == 0\) \{\s*\n\s*chdir \$android_dir or die\("Failed to enter android directory: \$!"\);\s*\n\s*exec \("\.\/gradlew"[^}]+\}\s*\n\s*waitpid\(\$gradle, 0\);\s*\n\s*die "Gradle build failed" unless \$\? == 0;/,
                    gradleBashExec
                );
                patched = true;
            }

            // Save patched content
            if (patched) {
                fs.writeFileSync(pixiewoodScriptPath, scriptContent, 'utf8');
                Logger.info('Patched pixiewood script for Windows');
            }

            // Patch android.cross for .cmd extension
            this.patchAndroidCross(pixiewoodScriptPath);

            // Patch gperf getopt.c for modern C compiler compatibility
            this.patchGperfGetopt();

            return patched;
        } catch (error) {
            Logger.warn(`Could not patch pixiewood: ${error.message}`);
            return false;
        }
    }

    /**
     * Patch android.cross file for .cmd extension
     * @param {string} pixiewoodScriptPath 
     */
    patchAndroidCross(pixiewoodScriptPath) {
        const pixiewoodDir = path.dirname(pixiewoodScriptPath);
        const androidCrossPath = path.join(pixiewoodDir, 'prepare', 'android.cross');

        if (fs.existsSync(androidCrossPath)) {
            let crossContent = fs.readFileSync(androidCrossPath, 'utf8');
            if (!crossContent.includes('+ cmd_ext')) {
                crossContent = crossContent.replace(
                    "c          = toolchain / 'bin' / arch+'-linux-'+platform+'31-clang'",
                    "c          = toolchain / 'bin' / arch+'-linux-'+platform+'31-clang' + cmd_ext"
                );
                crossContent = crossContent.replace(
                    "cpp        = toolchain / 'bin' / arch+'-linux-'+platform+'31-clang++'",
                    "cpp        = toolchain / 'bin' / arch+'-linux-'+platform+'31-clang++' + cmd_ext"
                );
                fs.writeFileSync(androidCrossPath, crossContent, 'utf8');
                Logger.info('Patched android.cross for Windows .cmd extension');
            }
        }
    }

    /**
     * Patch gperf getopt.c/h for Android NDK compatibility
     */
    patchGperfGetopt() {
        const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : null;
        if (!workspaceRoot) return;

        const gperfGetoptCPath = path.join(workspaceRoot, 'subprojects', 'gperf', 'lib', 'getopt.c');
        const gperfGetoptHPath = path.join(workspaceRoot, 'subprojects', 'gperf', 'lib', 'getopt.h');

        // Patch getopt.c
        if (fs.existsSync(gperfGetoptCPath)) {
            let getoptContent = fs.readFileSync(gperfGetoptCPath, 'utf8');
            let is_mod = false;


            if (getoptContent.includes('extern char *getenv ();') &&
                !getoptContent.includes('/* Patched for Android NDK compatibility */')) {
                // Replace K&R style declaration with ANSI C style
                getoptContent = getoptContent.replace(
                    'extern char *getenv ();',
                    '/* Patched for Android NDK compatibility */\n#include <stdlib.h> /* for getenv */'
                );

                // Also fix getopt declaration if present
                getoptContent = getoptContent.replace(
                    /extern int getopt \(\);/g,
                    '/* getopt declaration patched */\nextern int getopt (int argc, char *const *argv, const char *optstring);'
                );

                is_mod = true;
            }

            if (getoptContent.includes('extern int strncmp ();')) {
                getoptContent = getoptContent.replace(
                    'extern int strncmp ();',
                    '#include <string.h>'
                );

                is_mod = true;
            }

            if (is_mod) {
                fs.writeFileSync(gperfGetoptCPath, getoptContent, 'utf8');
                Logger.info('Patched gperf getopt.c for Android NDK');
            }

        }

        // Patch getopt.h
        if (fs.existsSync(gperfGetoptHPath)) {
            let getoptHContent = fs.readFileSync(gperfGetoptHPath, 'utf8');

            if (getoptHContent.includes('extern int getopt ();') &&
                !getoptHContent.includes('/* Patched for Android NDK */')) {
                getoptHContent = getoptHContent.replace(
                    'extern int getopt ();',
                    '/* Patched for Android NDK */\nextern int getopt (int argc, char *const *argv, const char *optstring);'
                );
                fs.writeFileSync(gperfGetoptHPath, getoptHContent, 'utf8');
                Logger.info('Patched gperf getopt.h for Android NDK');
            }
        }
    }
}

// Singleton instance
const pixiewoodPatcher = new PixiewoodPatcher();

module.exports = pixiewoodPatcher;
