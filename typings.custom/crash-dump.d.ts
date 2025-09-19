declare module 'crash-dump' {
  /**
   * Initialize crash dump functionality
   * @param dumpPath Path where crash dumps should be written
   * @returns Function to deinitialize crash dump functionality
   */
  function crashDump(dumpPath: string): () => void;
  
  export default crashDump;
}