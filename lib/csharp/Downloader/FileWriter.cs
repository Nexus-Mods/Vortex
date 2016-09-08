using System;
using System.IO;
using System.Text;
using System.Threading;
using Util.Collections;
using Util.Threading;

namespace Downloader
{
	/// <summary>
	/// Writes data to a file.
	/// </summary>
	public class FileWriter : IFileWriter
	{
        /// <summary>
        /// Describes a block of data that is to be written to a file.
        /// </summary>
        protected class FileBlock : IComparable<FileBlock>
        {
            #region Properties

            /// <summary>
            /// Gets the start position in the file at which to write
            /// this block's data.
            /// </summary>
            /// <value>The start position in the file at which to write
            /// this block's data.</value>
            public Int64 StartPosition { get; private set; }

            /// <summary>
            /// Gets the data to write to the file.
            /// </summary>
            /// <value>The data to write to the file.</value>
            public byte[] Data { get; private set; }

            #endregion

            #region Constructors

            /// <summary>
            /// A simple constructor that initializes the object with the given data.
            /// </summary>
            /// <param name="p_intStartPosition">The start position in the file at which to write
            /// this block's data.</param>
            /// <param name="p_bteData">The data to write to the file.</param>
            public FileBlock(Int64 p_intStartPosition, byte[] p_bteData)
            {
                StartPosition = p_intStartPosition;
                Data = p_bteData;
            }

            #endregion

            #region IComparable<FileBlock> Members

            /// <summary>
            /// Compares this <see cref="FileBlock"/> to another.
            /// </summary>
            /// <remarks>
            /// <see cref="FileBlock"/>s are strictly ordered by their <see cref="FileBlock.StartPosition"/>s.
            /// </remarks> 
            /// <param name="other">The <see cref="FileBlock"/> to which to compare this <see cref="FileBlock"/>.</param>
            /// <returns>A value less than 0 if this <see cref="FileBlock"/> is less than the other.
            /// 0 if this <see cref="FileBlock"/> is equal to the other.
            /// A value greater than 0 if this <see cref="FileBlock"/> is greater than the other.</returns>
            public int CompareTo(FileBlock other)
            {
                return StartPosition.CompareTo(other.StartPosition);
            }

            #endregion
        }

        private string m_strFilePath = null;
        private string m_strFileMetadataPath = null;
        private SortedList<FileBlock> m_sltBlocksToWrite = new SortedList<FileBlock>();
        private RangeSet m_rgsWrittenRanges = new RangeSet();
        private EventWaitHandle m_ewhProcessQueue = new EventWaitHandle(false, EventResetMode.ManualReset);
        private bool m_booIsClosing = false;
        private TrackedThread m_thdWrite = null;

        public event EventHandler UnableToWrite = delegate { };

        #region Properties

        /// <summary>
        /// Gets the total numbers of bytes that have beend written to the file.
        /// </summary>
        /// <value>The total numbers of bytes that have beend written to the file.</value>
        public UInt64 WrittenByteCount
        {
            get
            {
                return m_rgsWrittenRanges.TotalSize;
            }
        }

        #endregion

        #region Constructors

        /// <summary>
        /// A simple consturctor that initializes the object with the given values.
        /// </summary>
        /// <param name="p_strFilePath">The path of the file to which to write. If the
        /// file does not exist, is will be created.</param>
        /// <param name="p_strFileMetadataPath">The path of the file containing the metadata
        /// describing which parts of the file are already written.</param>
        public FileWriter(string p_strFilePath, string p_strFileMetadataPath)
        {
            m_strFilePath = p_strFilePath;
            m_strFileMetadataPath = p_strFileMetadataPath;

            if (File.Exists(p_strFileMetadataPath))
            {
                string[] strRanges = File.ReadAllLines(p_strFileMetadataPath);
                foreach (string strRange in strRanges)
                {
                    string strCleanRange = strRange.Trim().Trim('\0');
                    if (String.IsNullOrEmpty(strCleanRange))
                        continue;
                    m_rgsWrittenRanges.AddRange(Range.Parse(strCleanRange));
                }
            }

            m_thdWrite = new TrackedThread(WaitForData);
            m_thdWrite.Start();
        }

        #endregion

        #region Writing

        /// <summary>
        /// Writes blocks of data to the file being written.
        /// </summary>
        /// <remarks>
        /// This method is run on a separate thread. It waits to be signalled indicating that
        /// there is data queued to be written, writes the data, and waits for the next signal.
        /// 
        /// Every time the file is written to, the metadata file is updated to reflect which parts
        /// of the file have been written.
        /// </remarks>
        protected void WaitForData()
        {
            int intRetries = 0;
            string strFolder = Path.GetDirectoryName(m_strFilePath);
            if (!Directory.Exists(strFolder))
                Directory.CreateDirectory(strFolder);
            while (true)
            {
                while (m_sltBlocksToWrite.Count > 0)
                {
                    try
                    {
                        using (FileStream fsmFile = File.OpenWrite(m_strFilePath))
                        {
                            FileBlock fblData = null;
                            lock (m_sltBlocksToWrite)
                            {
                                fblData = m_sltBlocksToWrite[0];
                                m_sltBlocksToWrite.RemoveAt(0);
                            }
                            if (fblData.StartPosition > (Int64)fsmFile.Length)
                                fsmFile.SetLength(fblData.StartPosition + fblData.Data.Length);
                            fsmFile.Seek(fblData.StartPosition, SeekOrigin.Begin);
                            fsmFile.Write(fblData.Data, 0, fblData.Data.Length);

                            m_rgsWrittenRanges.AddRange(new Range((UInt64)fblData.StartPosition, (UInt64)(fblData.StartPosition + fblData.Data.Length - 1)));
                            StringBuilder stbRanges = new StringBuilder();
                            foreach (Range rngWritten in m_rgsWrittenRanges)
                                stbRanges.AppendLine(rngWritten.ToString());
                            File.WriteAllText(m_strFileMetadataPath, stbRanges.ToString());
                        }

                        intRetries = 0;
                    }
                    catch (IOException ex)
                    {
                        //See stackoverflow answer for determining if file is in use: http://stackoverflow.com/a/937558/1634249
                        var errorCode = System.Runtime.InteropServices.Marshal.GetHRForException(ex) & ((1 << 16) - 1);

                        if (errorCode == 32 || errorCode == 33)
                        {
                            //Wait for file to be unlocked, hopefully soon
                            //XXX what else could be done?
                            if (intRetries > 600)
                            {
                                UnableToWrite(this, new EventArgs());
                                return;
                            }
                            else
                                intRetries++;

                            Thread.Sleep(100);
                        }
                        else
                        {
                            //Unknown exception, standard error handling (crash)
                            throw;
                        }
                    }
                }
                if (m_booIsClosing && m_sltBlocksToWrite.Count == 0)
                    return;
                m_ewhProcessQueue.Reset();
                m_ewhProcessQueue.WaitOne();
            }
        }

        #endregion

        /// <summary>
        /// Closes the file writer.
        /// </summary>
        public void Close()
        {
            m_booIsClosing = true;
            m_ewhProcessQueue.Set();
            m_thdWrite.Thread.Join();
        }

        /// <summary>
        /// Enqueues a block of data to write to the file.
        /// </summary>
        /// <param name="p_intStartPosition">The start position in the file at which to write the data.</param>
        /// <param name="p_bteData">The data to write.</param>
        public void EnqueueBlock(UInt64 p_intStartPosition, byte[] p_bteData)
        {
            if (m_booIsClosing)
                return;
            lock (m_sltBlocksToWrite)
            {
                m_sltBlocksToWrite.Add(new FileBlock((Int64)p_intStartPosition, p_bteData));
                m_ewhProcessQueue.Set();
            }
        }

        #region IDisposable Members

        /// <summary>
        /// Disposes of the resources used by the class.
        /// </summary>
        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        virtual protected void Dispose(bool disposing)
        {
            if (disposing)
            {
                Close();
            } else
            {
                m_ewhProcessQueue.Close();
            }
        }

        #endregion
    }
}
