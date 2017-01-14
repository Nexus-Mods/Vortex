using System.Collections.Generic;
using System.IO;

namespace Utils
{
    /// <summary>
    /// Utility functions to work with text.
    /// </summary>
    public static class TextUtil
    {
        /// <summary>
        /// Converts the given byte array to a string.
        /// </summary>
        /// <remarks>
        /// This method attempts to detect the text encoding.
        /// </remarks>
        /// <param name="p_bteText">The bytes to convert to a string.</param>
        /// <returns>A string respresented by the given bytes.</returns>
        public static string ByteToString(byte[] p_bteText)
        {
            string strText;
            using (MemoryStream msmFile = new MemoryStream(p_bteText))
            {
                using (StreamReader strReader = new StreamReader(msmFile, true))
                {
                    strText = strReader.ReadToEnd();
                    strReader.Close();
                }
                msmFile.Close();
            }
            return strText;
        }

        /// <summary>
        /// Converts the given byte array to an array of string lines.
        /// </summary>
        /// <remarks>
        /// This method attempts to detect the text encoding.
        /// </remarks>
        /// <param name="p_bteText">The bytes to convert to an array of string lines.</param>
        /// <returns>An array of string lines respresented by the given bytes.</returns>
        public static string[] ByteToStringLines(byte[] p_bteText)
        {
            List<string> lstLines = new List<string>();
            using (MemoryStream msmFile = new MemoryStream(p_bteText))
            {
                using (StreamReader strReader = new StreamReader(msmFile, true))
                {
                    string strLine = null;
                    while ((strLine = strReader.ReadLine()) != null)
                        lstLines.Add(strLine);
                    strReader.Close();
                }
                msmFile.Close();
            }
            return lstLines.ToArray();
        }
    }
}
