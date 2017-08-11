using System;

namespace Nexus.Client.Util.Antlr
{
	/// <summary>
	/// Describes an error genered while parsing CPL.
	/// </summary>
	public class LanguageError
	{
		#region Properties

		/// <summary>
		/// Gets or sets the line in the code where the error was encountered.
		/// </summary>
		/// <value>The line in the code where the error was encountered.</value>
		public Int32 Line { get; set; }

		/// <summary>
		/// Gets or sets the column in the line in the code where
		/// the error was encountered.
		/// </summary>
		/// <value>The column in the line in the code where
		/// the error was encountered.</value>
		public Int32 Column { get; set; }


		/// <summary>
		/// Gets or sets the position in the code where the error was encountered.
		/// </summary>
		/// <value>The position in the code where the error was encountered.</value>
		public Int32 Position { get; set; }

		/// <summary>
		/// Gets or sets the position in the code where the error ends.
		/// </summary>
		/// <value>The position in the code where the error ends.</value>
		public Int32 End { get; set; }

		/// <summary>
		/// Gets or sets the error message.
		/// </summary>
		/// <value>The error message.</value>
		public string Message { get; set; }

		#endregion

		/// <summary>
		/// Generates a string representation of the class.
		/// </summary>
		/// <remarks>
		/// This returns an error message summarizing the error's data.
		/// </remarks>
		/// <returns>A string representation of the class.</returns>
		public override string ToString()
		{
			return String.Format("{0},{1}: {2}", Line, Column, Message);
		}
	}
}
