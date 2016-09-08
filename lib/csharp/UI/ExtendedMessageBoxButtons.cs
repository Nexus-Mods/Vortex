using System;

namespace UI
{
	/// <summary>
	/// The buttons that can be displayed in an <see cref="ExtendedMessageBox"/>.
	/// </summary>
	/// <remarks>
	/// This enumeration is marked as flags, allowing any combination of buttons
	/// to be displayed.
	/// </remarks>
	[Flags]
	public enum ExtendedMessageBoxButtons
	{
		/// <summary>
		/// No buttons.
		/// </summary>
		None = 0x0,
		
		/// <summary>
		/// The cancel button.
		/// </summary>
		Cancel = 0x1,

		/// <summary>
		/// The OK button.
		/// </summary>
		OK = 0x2,

		/// <summary>
		/// The Yes button.
		/// </summary>
		Yes = 0x4,

		/// <summary>
		/// The No button.
		/// </summary>
		No = 0x8,
		
		/// <summary>
		/// The Abort button.
		/// </summary>
		Abort = 0x10,
		
		/// <summary>
		/// The Retry button.
		/// </summary>
		Retry = 0x20,
		
		/// <summary>
		/// The Ignore button.
		/// </summary>
		Ignore = 0x40,

		/// <summary>
		/// The Backup button.
		/// </summary>
		Backup = 0x80,

		/// <summary>
		/// The Update button.
		/// </summary>
		Update = 0x101,
		
	}
}
