using System.ComponentModel;
using System.Drawing;

namespace Commands.Generic
{
	/// <summary>
	/// A command that requires an argument, and has on and off states.
	/// </summary>
	/// <typeparam name="T">The type of the command argument.</typeparam>
	public class CheckedCommand<T> : Command<T>
	{
		private bool m_booIsChecked;

		#region Properties

		/// <summary>
		/// Gets or sets whether the command is checked.
		/// </summary>
		/// <value>Whether the command is checked.</value>
		public bool IsChecked
		{
			get
			{
				return this.m_booIsChecked;
			}
			set
			{
				if (this.m_booIsChecked != value)
				{
					this.m_booIsChecked = value;
					OnPropertyChanged(new PropertyChangedEventArgs("IsChecked"));
				}
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		public CheckedCommand(string p_strName, string p_strDescription, CommandExecuterMethod<T> p_eehExecute)
			: this(null, p_strName, p_strDescription, null, p_eehExecute, true)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_booIsChecked">Whether the command is checked.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		public CheckedCommand(string p_strName, string p_strDescription, bool p_booIsChecked, CommandExecuterMethod<T> p_eehExecute)
			: this(null, p_strName, p_strDescription, null, p_booIsChecked, p_eehExecute, true)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public CheckedCommand(string p_strName, string p_strDescription, CommandExecuterMethod<T> p_eehExecute, bool p_booCanExecute)
			: this(null, p_strName, p_strDescription, null, p_eehExecute, p_booCanExecute)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_booIsChecked">Whether the command is checked.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public CheckedCommand(string p_strName, string p_strDescription, bool p_booIsChecked, CommandExecuterMethod<T> p_eehExecute, bool p_booCanExecute)
			: this(null, p_strName, p_strDescription, null, p_booIsChecked, p_eehExecute, p_booCanExecute)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strId">The id of the command</param>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_imgImage">The image of the command.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public CheckedCommand(string p_strId, string p_strName, string p_strDescription, Image p_imgImage, CommandExecuterMethod<T> p_eehExecute, bool p_booCanExecute)
			: this(p_strId, p_strName, p_strDescription, p_imgImage, false, p_eehExecute, p_booCanExecute)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strId">The id of the command</param>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_imgImage">The image of the command.</param>
		/// <param name="p_booIsChecked">Whether the command is checked.</param>
		/// <param name="p_eehExecute">An <see cref="CommandExecuterMethod{T}"/> that will be
		/// perform the command work.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public CheckedCommand(string p_strId, string p_strName, string p_strDescription, Image p_imgImage, bool p_booIsChecked, CommandExecuterMethod<T> p_eehExecute, bool p_booCanExecute)
			: base(p_strId, p_strName, p_strDescription, p_imgImage, p_eehExecute, p_booCanExecute)
		{
			IsChecked = p_booIsChecked;
		}

		#endregion
	}
}
