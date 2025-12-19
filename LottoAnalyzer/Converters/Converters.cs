using System;
using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;
using LottoAnalyzer.Models;

namespace LottoAnalyzer.Converters
{
    /// <summary>
    /// 번호를 색상으로 변환하는 컨버터
    /// </summary>
    public class NumberToColorConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values[0] is int number)
            {
                return number switch
                {
                    >= 1 and <= 10 => Color.FromRgb(251, 196, 0),   // Yellow
                    >= 11 and <= 20 => Color.FromRgb(105, 200, 242), // Blue
                    >= 21 and <= 30 => Color.FromRgb(255, 114, 114), // Red
                    >= 31 and <= 40 => Color.FromRgb(170, 170, 170), // Gray
                    _ => Color.FromRgb(176, 216, 64)                 // Green
                };
            }
            return Colors.Gray;
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    /// <summary>
    /// 부울 값을 반전시키는 컨버터
    /// </summary>
    public class InverseBooleanConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
                return !boolValue;
            return true;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
                return !boolValue;
            return false;
        }
    }

    /// <summary>
    /// 부울 값을 Visibility로 변환하는 컨버터
    /// </summary>
    public class BoolToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
                return boolValue ? Visibility.Visible : Visibility.Collapsed;
            return Visibility.Collapsed;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is Visibility visibility)
                return visibility == Visibility.Visible;
            return false;
        }
    }

    /// <summary>
    /// DataGrid 행 인덱스 컨버터
    /// </summary>
    public class RowIndexConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is System.Windows.Controls.DataGridRow row)
            {
                return row.GetIndex() + 1;
            }
            return 0;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    /// <summary>
    /// Season을 한글로 변환하는 컨버터
    /// </summary>
    public class SeasonToKoreanConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is Season season)
            {
                return season.ToKorean();
            }
            return "";
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    /// <summary>
    /// 번호를 브러시로 변환하는 컨버터 (단일 값)
    /// </summary>
    public class NumberToBrushConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is int number)
            {
                var color = number switch
                {
                    >= 1 and <= 10 => Color.FromRgb(251, 196, 0),
                    >= 11 and <= 20 => Color.FromRgb(105, 200, 242),
                    >= 21 and <= 30 => Color.FromRgb(255, 114, 114),
                    >= 31 and <= 40 => Color.FromRgb(170, 170, 170),
                    _ => Color.FromRgb(176, 216, 64)
                };
                return new SolidColorBrush(color);
            }
            return Brushes.Gray;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
