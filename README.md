# Hammonia Taxi Shift Planner

A responsive web application for managing taxi shift bookings in a small taxi company. Built with Next.js, Material-UI, and Supabase.

## Features

- **Two User Roles**: Admin and Driver with role-based access control
- **Shift Management**: Book, edit, and delete shifts with conflict prevention
- **Multi-language Support**: English and German translations
- **Real-time Updates**: Live data synchronization with Supabase
- **Analytics Dashboard**: View shift statistics and taxi utilization
- **Responsive Design**: Works on desktop and mobile devices
- **Material Design**: Modern, intuitive user interface

## Prerequisites

- Node.js 18+ and npm/yarn
- A Supabase account (free tier)
- A Vercel account (free tier) for deployment

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone the repository (or create a new project)
git clone <your-repo-url>
cd hammonia-taxi-shift-planner

# Install dependencies
npm install
# or
yarn install
```

### 2. Set Up Supabase

1. **Create a Supabase Project**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up/login and create a new project
   - Choose a strong database password
   - Select a region close to your users

2. **Configure the Database**
   - In your Supabase dashboard, go to the SQL Editor
   - Copy the entire contents of `supabase/schema.sql`
   - Paste and run it in the SQL Editor
   - This will create all necessary tables, relationships, and RLS policies

3. **Get Your API Keys**
   - Go to Settings → API in your Supabase dashboard
   - Copy the `Project URL` and `anon public` key
   - You'll need these for the environment variables

4. **Configure Authentication**
   - Go to Authentication → Settings
   - Enable Email/Password authentication
   - Configure email templates if desired (optional)

5. **Create an Admin User**
   - Go to Authentication → Users
   - Click "Invite User" and create an admin account
   - After the user is created, go to the SQL Editor and run:
   ```sql
   UPDATE profiles 
   SET is_admin = true 
   WHERE email = 'admin@yourdomain.com';
   ```

### 3. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### 5. Deploy to Vercel

1. **Connect to Vercel**
   ```bash
   npx vercel
   ```
   Follow the prompts to link your project to Vercel.

2. **Set Environment Variables in Vercel**
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings → Environment Variables
   - Add the same variables from your `.env.local` file

3. **Deploy**
   ```bash
   npx vercel --prod
   ```
   Or push to your main branch if you've set up automatic deployments.

## Usage Guide

### For Admins

1. **Login**: Use your admin credentials at the login page
2. **Manage Drivers**: Add, edit, or remove driver accounts
3. **Manage Taxis**: Add or remove taxis from the fleet
4. **View All Shifts**: See and manage all driver shifts
5. **Analytics**: View statistics and utilization reports

### For Drivers

1. **Login**: Use credentials provided by admin
2. **Book Shifts**: Select taxi, date, and time for shifts
3. **View My Shifts**: See upcoming and past shifts
4. **Edit/Delete**: Manage your own shifts

## Database Schema

### Tables

- **profiles**: User profiles extending Supabase auth
- **taxis**: Fleet vehicles with license plates
- **shifts**: Booked shifts linking drivers to taxis

### Row Level Security

- Drivers can only see/modify their own shifts
- Admins have full access to all data
- All tables are protected with RLS policies

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables" error**
   - Ensure `.env.local` file exists with correct values
   - Restart the development server after adding variables

2. **Login fails with valid credentials**
   - Check if the user exists in Supabase Authentication
   - Verify the profile was created in the profiles table

3. **Cannot book shifts (conflict error)**
   - Check for overlapping shifts in the database
   - Ensure shift duration is under 10 hours

4. **Admin features not accessible**
   - Verify `is_admin` is true for your user in profiles table
   - Check RLS policies are properly configured

## Development Notes

### Project Structure

```
src/
├── app/              # Next.js app router pages
│   ├── admin/        # Admin pages
│   ├── driver/       # Driver pages
│   └── login/        # Authentication
├── components/       # Reusable React components
├── contexts/         # React contexts (Auth)
├── lib/             # Utilities and configurations
│   ├── supabase/    # Supabase client and types
│   ├── i18n/        # Translations
│   └── theme.ts     # Material-UI theme
└── types/           # TypeScript type definitions
```

### Key Technologies

- **Next.js 14**: React framework with app router
- **Material-UI v5**: Component library and theming
- **Supabase**: Backend as a service (Auth + Database)
- **TypeScript**: Type safety
- **date-fns**: Date manipulation
- **react-i18next**: Internationalization
- **notistack**: Toast notifications

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

## Security Considerations

- All database access is protected by Row Level Security
- API keys are public (anon key) but protected by RLS
- Never expose service role keys in client-side code
- Passwords are handled by Supabase Auth (bcrypt)
- Session tokens expire and refresh automatically

## Future Enhancements

- [ ] Calendar view for shifts
- [ ] Email notifications for shift changes
- [ ] Mobile app version
- [ ] Export shifts to CSV/PDF
- [ ] Advanced analytics and reporting
- [ ] Shift templates for recurring schedules
- [ ] Driver availability management
- [ ] Integration with payroll systems

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase logs in your dashboard
3. Check browser console for errors
4. Verify all environment variables are set correctly

## License

This project is proprietary software for Hammonia Taxi.

---

Built with ❤️ for Hammonia Taxi