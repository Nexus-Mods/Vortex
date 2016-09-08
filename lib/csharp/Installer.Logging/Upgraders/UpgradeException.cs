using System;

namespace Installer.Logging.Upgraders
{
	/// <summary>
	/// The exception that is thrown if an error occurs during the upgrading of an install log.
	/// </summary>
	[Serializable]
	public class UpgradeException : Exception
	{
		/// <summary>
		/// The default constructor.
		/// </summary>
		public UpgradeException()
		{
		}

		/// <summary>
		/// A simple contructor that sets the exception's message.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		public UpgradeException(string message)
			: base(message)
		{
		}

		/// <summary>
		/// A simple constructor the sets the exception's message and inner exception.
		/// </summary>
		/// <param name="message">The exception's message.</param>
		/// <param name="inner">The ineer exception.</param>
		public UpgradeException(string message, Exception inner)
			: base(message, inner)
		{
		}
	}
}
