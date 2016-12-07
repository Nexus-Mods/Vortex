using System;
using System.ComponentModel;
using System.Linq.Expressions;

namespace Utils
{
	public class ObservableObject : INotifyPropertyChanged
	{
		public static PropertyChangedEventArgs CreatePropertyChangedEventArgs<T>(Expression<Func<T>> p_expProperty)
		{
			return new PropertyChangedEventArgs(ObjectHelper.GetPropertyName(p_expProperty));
		}

		#region INotifyPropertyChanged Members

		public event PropertyChangedEventHandler PropertyChanged = delegate { };

		#endregion

		/// <summary>
		/// Determins if the given values differ.
		/// </summary>
		/// <typeparam name="T">The type of the values.</typeparam>
		/// <param name="p_tOldValue">The old value.</param>
		/// <param name="p_tNewValue">The new value.</param>
		/// <returns><c>true</c> if the values are different;
		/// <c>false</c> otherwise.</returns>
		protected bool CheckIfChanged<T>(T p_tOldValue, T p_tNewValue)
		{
			if ((p_tOldValue == null) && (p_tNewValue == null))
				return false;
			if ((p_tOldValue == null) || !p_tOldValue.Equals((T)p_tNewValue))
				return true;
			return false;
		}

		protected bool SetPropertyIfChanged<T>(ref T p_tOldValue, T p_tNewValue, PropertyChangedEventArgs e)
		{
			if (CheckIfChanged(p_tOldValue, p_tNewValue))
			{
				p_tOldValue = p_tNewValue;
				OnPropertyChanged(e);
				return true;
			}
			return false;
		}

		protected bool SetPropertyIfChanged<T>(ref T p_tOldValue, T p_tNewValue, Expression<Func<T>> p_expProperty)
		{
			return SetPropertyIfChanged(ref p_tOldValue, p_tNewValue, CreatePropertyChangedEventArgs(p_expProperty));
		}

		protected void OnPropertyChanged<T>(Expression<Func<T>> p_expProperty)
		{
			OnPropertyChanged(CreatePropertyChangedEventArgs(p_expProperty));
		}

		protected virtual void OnPropertyChanged(PropertyChangedEventArgs e)
		{
			PropertyChanged(this, e);
		}
	}
}
