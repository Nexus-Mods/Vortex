using System;

namespace Nexus.Client.ModManagement.Scripting.XmlScript.Unparsers
{
	/// <summary>
	/// The exception that is thrown if a feature of an XML Script cannot be unparsed to the
	/// target script version.
	/// </summary>
	public class UnsupportedScriptFeatureException : Exception
	{
		/// <summary>
		/// The default constructor.
		/// </summary>
		public UnsupportedScriptFeatureException()
		{
		}

		/// <summary>
		/// A simple contructor that sets the exception's message.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		public UnsupportedScriptFeatureException(string message)
			: base(message)
		{
		}

		/// <summary>
		/// A simple constructor the sets the exception's message and inner exception.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		/// <param name="inner">The ineer exception.</param>
		public UnsupportedScriptFeatureException(string message, Exception inner)
			: base(message, inner)
		{
		}
	}
}
