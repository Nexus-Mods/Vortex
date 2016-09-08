using System;
using System.Diagnostics;
using System.Text;

namespace Util
{
	/// <summary>
	/// Utility functions to work with the Tracer.
	/// </summary>
	public static class TraceUtil
	{
		/// <summary>
		/// This writes information detailing the given exception to the trace log.
		/// </summary>
		/// <param name="ex">The exceptions to describe.</param>
		public static void TraceException(Exception ex)
		{
			Trace.TraceError(CreateTraceExceptionString(ex));
		}

		/// <summary>
		/// This builds a string detailing the given exception.
		/// </summary>
		/// <param name="ex">The exceptions to describe.</param>
		/// <returns>A string detailing the given exception.</returns>
		public static string CreateTraceExceptionString(Exception ex)
		{
			if (ex == null)
				return "\tNO EXCEPTION.";

			StringBuilder stbException = new StringBuilder();
			stbException.AppendLine("Exception: ");
			stbException.AppendLine("Message: ").Append("\t");
			stbException.AppendLine(ex.Message);
			stbException.AppendLine("Full Trace: ").Append("\t");
			stbException.AppendLine(ex.ToString());
			if (ex is BadImageFormatException)
			{
				BadImageFormatException biex = (BadImageFormatException)ex;
				stbException.AppendFormat("File Name:\t{0}", biex.FileName).AppendLine();
				stbException.AppendFormat("Fusion Log:\t{0}", biex.FusionLog).AppendLine();
			}
			while (ex.InnerException != null)
			{
				ex = ex.InnerException;
				stbException.AppendLine("Inner Exception:");
				stbException.AppendLine(ex.ToString());
			}
			return stbException.ToString();
		}
	}
}
