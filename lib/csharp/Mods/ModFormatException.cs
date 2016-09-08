using System;

namespace Mods
{
	/// <summary>
	/// The exception that is thrown if a file is not compatible with a specific mod format.
	/// </summary>
	[Serializable]
	public class ModFormatException : Exception
	{
		private const string ErrorMessage = "The specified file is not in a {0} compatible format.";
		/// <summary>
		/// The default constructor.
		/// </summary>
		public ModFormatException()
		{
		}

		/// <summary>
		/// A simple contructor that sets the exception's message.
		/// </summary>
		/// <param name="p_mftFormat">The expected mod format.</param>
		public ModFormatException(IModFormat p_mftFormat)
			: base(String.Format(ErrorMessage, p_mftFormat.Name))
		{
		}

		/// <summary>
		/// A simple constructor the sets the exception's message and inner exception.
		/// </summary>
		/// <param name="p_mftFormat">The expected mod format.</param>
		/// <param name="inner">The ineer exception.</param>
		public ModFormatException(IModFormat p_mftFormat, Exception inner)
			: base(String.Format(ErrorMessage, p_mftFormat.Name), inner)
		{
		}
	}
}
