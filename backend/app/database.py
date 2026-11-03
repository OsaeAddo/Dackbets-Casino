from supabase import Client, create_client

from app.config import settings


class AdminClientUnavailableError(RuntimeError):
    """Raised when a service-role operation is attempted without an admin client."""


class SupabaseDB:
    def __init__(self):
        # print(f"Init. Supabase client with URL and Key: {settings.supabase_url}, {settings.supabase_key}") 
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
        
        # Admin client for service role operations
        self.admin_client: Client = create_client(
            settings.supabase_url,
            settings.supabase_secret_key
        ) if settings.supabase_secret_key else None
    
    def get_client(self):
        return self.client

    @property
    def casino_client(self) -> Client:
        """Client for the casino_* tables.

        RLS on those tables denies anon/authenticated by default, so the API
        must use the service-role client. Auth calls keep using `client`.
        """
        if not self.admin_client:
            raise AdminClientUnavailableError(
                "SUPABASE_SECRET_KEY is required: casino tables are service-role only"
            )
        return self.admin_client

    #User management methods
    def sign_up(self, email: str, password: str):
        return self.client.auth.sign_up({
            "email":email,
            "password": password
        })
        
    def sign_in(self, email: str, password: str):
        return self.client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
    def sign_out(self, access_token: str):
        return self.client.auth.sign_out({access_token})
            
    def get_user_with_supabase_token(self, supabase_token: str):
        """
        Get user using Supabase's JWT token
        """
        return self.client.auth.get_user(supabase_token)
    
    def get_user_by_id(self, user_id: str):
        """
        Get user by ID using admin privileges
        """
        if not self.admin_client:
            raise AdminClientUnavailableError("Admin client not available")
        
        response = self.admin_client.auth.admin.get_user_by_id(user_id)
        return response.user
    
    # app/api/auth.py - Using the view

    async def get_user_by_email(self, email: str):
        """
        Get user by email using the scoped get_user_by_email RPC.

        The RPC is security definer but only ever returns the row matching the
        supplied address, so the anon key cannot enumerate auth.users.
        """
        try:
            response = self.client.rpc(
                "get_user_by_email",
                {"p_email": email},
            ).execute()

            row = response.data[0] if response.data else None
            if row:
                class UserFromView:
                    def __init__(self, data):
                        self.id = data["id"]
                        self.email = data["email"]
                        self.email_confirmed_at = data.get("email_confirmed_at")
                        self.created_at = data.get("created_at")
                        self.username = data.get("username")

                return UserFromView(row)
            else:
                return None

        except Exception:  # noqa: BLE001 - Profile lookup: a backend failure must not break signup/login
            return None
        
    
    # def get_claims(self, access_token: str):
        # return self.client.auth.get_claims(access_token)

    def update_user(self, access_token: str, **kwargs):
        return self.client.auth.update_user(access_token, kwargs)

        
# Initialize database connection
db = SupabaseDB()