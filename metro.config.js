const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.symbolicator ??= {};

const previousCustomizeFrame = config.symbolicator.customizeFrame;
const previousCustomizeStack = config.symbolicator.customizeStack;

// Hermes occasionally emits frames that point to a virtual "InternalBytecode.js"
// file. Metro then tries to load that path from disk, which fails with ENOENT
// and floods the console. We collapse or drop those frames during symbolication
// so the resolver never attempts to read the non-existent file.
config.symbolicator.customizeFrame = (frame) => {
  const nextFrame =
    typeof previousCustomizeFrame === 'function'
      ? previousCustomizeFrame(frame)
      : frame;

  if (
    nextFrame &&
    typeof nextFrame.file === 'string' &&
    nextFrame.file.endsWith('InternalBytecode.js')
  ) {
    return { ...nextFrame, collapse: true };
  }

  return nextFrame;
};

config.symbolicator.customizeStack = async (stack, context) => {
  const baseStack = await (typeof previousCustomizeStack === 'function'
    ? previousCustomizeStack(stack, context)
    : stack);

  const filteredStack = baseStack.filter(
    (frame) =>
      !(
        frame &&
        typeof frame.file === 'string' &&
        frame.file.endsWith('InternalBytecode.js')
      )
  );

  if (filteredStack.length === 0) {
    return baseStack.map((frame) =>
      frame &&
      typeof frame.file === 'string' &&
      frame.file.endsWith('InternalBytecode.js')
        ? { ...frame, collapse: true }
        : frame
    );
  }

  return filteredStack;
};

module.exports = config;
