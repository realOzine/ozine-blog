---
title: MinGW各版本的区别
date: 2022-09-10
---
# MinGW各版本的区别
mingw-w64多个文件区别介绍：

```
i686-13.1.0-release-posix-dwarf-msvcrt-rt_v11-rev1.7z
i686-13.1.0-release-posix-dwarf-ucrt-rt_v11-rev1.7z
i686-13.1.0-release-win32-dwarf-msvcrt-rt_v11-rev1.7z
i686-13.1.0-release-win32-dwarf-ucrt-rt_v11-rev1.7z
x86_64-13.1.0-release-posix-seh-msvcrt-rt_v11-rev1.7z
x86_64-13.1.0-release-posix-seh-ucrt-rt_v11-rev1.7z
x86_64-13.1.0-release-win32-seh-msvcrt-rt_v11-rev1.7z
x86_64-13.1.0-release-win32-seh-ucrt-rt_v11-rev1.7z
winlibs-i686-mcf-dwarf-gcc-13.1.0-mingw-w64msvcrt-11.0.0-r5.zip
winlibs-i686-mcf-dwarf-gcc-13.1.0-mingw-w64ucrt-11.0.0-r5.zip
winlibs-i686-posix-dwarf-gcc-13.1.0-llvm-16.0.5-mingw-w64msvcrt-11.0.0-r5/
winlibs-i686-posix-dwarf-gcc-13.1.0-llvm-16.0.5-mingw-w64msvcrt-11.0.0-r5.7z
winlibs-i686-posix-dwarf-gcc-13.1.0-llvm-16.0.5-mingw-w64ucrt-11.0.0-r5.7z
winlibs-x86_64-mcf-seh-gcc-13.1.0-mingw-w64msvcrt-11.0.0-r5.zip
winlibs-x86_64-mcf-seh-gcc-13.1.0-mingw-w64ucrt-11.0.0-r5.zip
winlibs-x86_64-posix-seh-gcc-13.1.0-llvm-16.0.5-mingw-w64msvcrt-11.0.0-r5/
winlibs-x86_64-posix-seh-gcc-13.1.0-llvm-16.0.5-mingw-w64msvcrt-11.0.0-r5.7z
winlibs-x86_64-posix-seh-gcc-13.1.0-llvm-16.0.5-mingw-w64ucrt-11.0.0-r5.7z
```

**MinGW-w64**是一个免费的开源C库，用于针对Windows 32位和64位平台。

- **i686** 和 **x86_64** 的区别是指编译器的目标架构。这两者之间有一些区别，例如在寄存器数量和大小，内存寻址，指令集等方面。
    - **i686** 是 32 位的 x86 架构，另外**Win32 - i686 - Windows 32** 位版本，本机运行并针对 Windows 32 位进行编译（也可在 Windows 64 位上运行，但在 32 位模式下）
    - **x86_64** 是 64 位的 x86 架构。**Win64 - x86_64 - Windows 64** 位版本，本机运行并针对 Windows 64 位进行编译（不会在 Windows 32 位上运行）
- **posix** 和 **win32** 的区别是指编译器使用的线程模型。posix 是一种 UNIX API 标准，而 win32 是 Windows 的 API 标准。这两者之间有一些区别，例如在 mingw-w64 中，使用 posix 线程将启用 C++11/C11 多线程功能，并使 libgcc 依赖于 libwinpthreads。而使用 win32 线程则不会启用 C++11 多线程功能。
- **MCF**是MCF Gthread是Windows 7及更高版本的线程支持库，它实现了gthread接口集，GCC在内部使用它来提供本地静态对象的初始化同步，libstdc++在内部使用它来提供C++11线程工具。
- **seh** 和 **dwarf** 的区别是指编译器使用的异常处理模型。
    - **seh** 的意思是结构化异常处理（Structured Exception Handling），是一种在 Windows 上处理异常的机制。seh 可以处理硬件异常（如除零错误）和软件异常（如访问无效内存）。seh 也可以与 C++ 异常兼容。
    - **dwarf** 是一种在 Linux 上处理异常的机制，它使用了一种叫做 DWARF 的调试信息格式来描述程序的结构和行为。dwarf 可以处理 C++ 异常，但不能处理硬件异常。
- **msvcrt** 的意思是 Microsoft Visual C++ 运行时（Microsoft Visual C++ Runtime），是一个提供 C 标准库函数的动态链接库。msvcrt 是 Windows 系统自带的，但由于向后兼容性的问题，它没有完全遵循 C99 标准，并且缺少一些功能。
- **ucrt** 的意思是通用 C 运行时（Universal C Runtime），是一个提供 C 标准库函数的动态链接库。ucrt 是 Windows 10 及更新版本的系统自带的，它遵循了 C99 和 C11 标准，并且提供了一些额外的功能。
- GDB - GNU 工程调试器
- GNU Binutils - 二进制工具的集合
- GNU Make - 一个控制可执行文件和其他非源文件生成的工具
- Yasm - Yasm 模块化汇编程序项目
- NASM - 全网汇编程序
- JWasm - 一个免费的MASM兼容汇编程序
- LLVM/Clang/LLD/LLDB - LLVM 编译器基础结构